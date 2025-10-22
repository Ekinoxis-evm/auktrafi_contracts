// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DigitalHouseVault
 * @dev Contrato para gestionar reservas de propiedades con sistema de subastas
 */
contract DigitalHouseVault is ReentrancyGuard, Ownable {
    
    // Estados del contrato
    enum VaultState { FREE, AUCTION, SETTLED }
    
    // Estructura de reserva
    struct Reservation {
        address booker;
        uint256 stakeAmount;
        uint256 shares;
        uint256 checkInDate;
        uint256 checkOutDate;
        uint256 nonce;
        bool isActive;
    }
    
    // Estructura de oferta en subasta
    struct AuctionBid {
        address bidder;
        uint256 amount;
        uint256 timestamp;
        bool isActive;
    }
    
    // Variables de estado
    IERC20 public pyusdToken;
    VaultState public currentState;
    
    string public vaultId;
    string public propertyDetails;
    uint256 public basePrice;
    uint256 public currentNonce;
    
    Reservation public currentReservation;
    AuctionBid[] public auctionBids;
    
    // Constantes de distribución
    uint256 constant PAYMENT_REALESTATE_PCT = 95;
    uint256 constant PAYMENT_DIGITALHOUSE_PCT = 5;
    uint256 constant CITIZEN_HOTEL_PCT = 50;
    uint256 constant CITIZEN_OWNER_PCT = 30;
    uint256 constant CITIZEN_DIGITALHOUSE_PCT = 20;
    
    // Direcciones de recepción
    address public realEstateAddress; // Owner del vault (hotel)
    address public digitalHouseAddress; // Digital House multisig
    
    // Eventos
    event ReservationCreated(address indexed booker, uint256 amount, uint256 checkInDate);
    event BidPlaced(address indexed bidder, uint256 amount);
    event BidWithdrawn(address indexed bidder, uint256 amount);
    event ReservationCeded(address indexed originalBooker, address indexed newBooker, uint256 amount);
    event CheckInCompleted(address indexed booker, string accessCode);
    event CheckOutCompleted(address indexed booker, uint256 nonce);
    
    constructor(
        address _pyusdToken,
        address _realEstateAddress,
        address _digitalHouseAddress,
        string memory _vaultId,
        string memory _propertyDetails,
        uint256 _basePrice
    ) Ownable(msg.sender) {
        pyusdToken = IERC20(_pyusdToken);
        realEstateAddress = _realEstateAddress;
        digitalHouseAddress = _digitalHouseAddress;
        vaultId = _vaultId;
        propertyDetails = _propertyDetails;
        basePrice = _basePrice;
        currentState = VaultState.FREE;
        currentNonce = 1;
    }
    
    /**
     * @dev Crear reserva inicial con stake
     */
    function createReservation(
        uint256 _stakeAmount,
        uint256 _checkInDate,
        uint256 _checkOutDate
    ) external nonReentrant {
        require(currentState == VaultState.FREE, "Vault not available");
        require(_stakeAmount >= basePrice, "Stake below base price");
        require(_checkInDate > block.timestamp, "Check-in must be in future");
        require(_checkOutDate > _checkInDate, "Invalid dates");
        
        // Transfer PYUSD stake
        require(
            pyusdToken.transferFrom(msg.sender, address(this), _stakeAmount),
            "Transfer failed"
        );
        
        // Crear reserva con 100% ownership (shares)
        currentReservation = Reservation({
            booker: msg.sender,
            stakeAmount: _stakeAmount,
            shares: 100, // 100% ownership
            checkInDate: _checkInDate,
            checkOutDate: _checkOutDate,
            nonce: currentNonce,
            isActive: true
        });
        
        currentState = VaultState.AUCTION;
        
        emit ReservationCreated(msg.sender, _stakeAmount, _checkInDate);
    }
    
    /**
     * @dev Hacer una oferta en la subasta
     */
    function placeBid(uint256 _bidAmount) external nonReentrant {
        require(currentState == VaultState.AUCTION, "Not in auction state");
        require(_bidAmount > currentReservation.stakeAmount, "Bid must be higher");
        require(
            block.timestamp < currentReservation.checkInDate - 1 days,
            "Too close to check-in"
        );
        
        // Transfer bid amount
        require(
            pyusdToken.transferFrom(msg.sender, address(this), _bidAmount),
            "Transfer failed"
        );
        
        // Agregar a lista de ofertas
        auctionBids.push(AuctionBid({
            bidder: msg.sender,
            amount: _bidAmount,
            timestamp: block.timestamp,
            isActive: true
        }));
        
        emit BidPlaced(msg.sender, _bidAmount);
    }
    
    /**
     * @dev Retirar oferta de subasta
     */
    function withdrawBid(uint256 _bidIndex) external nonReentrant {
        require(_bidIndex < auctionBids.length, "Invalid bid index");
        AuctionBid storage bid = auctionBids[_bidIndex];
        
        require(bid.bidder == msg.sender, "Not your bid");
        require(bid.isActive, "Bid already withdrawn");
        
        bid.isActive = false;
        
        // Devolver fondos
        require(
            pyusdToken.transfer(msg.sender, bid.amount),
            "Transfer failed"
        );
        
        emit BidWithdrawn(msg.sender, bid.amount);
    }
    
    /**
     * @dev Original booker decide ceder a una oferta mayor
     */
    function cedeReservation(uint256 _bidIndex) external nonReentrant {
        require(msg.sender == currentReservation.booker, "Not original booker");
        require(currentState == VaultState.AUCTION, "Not in auction state");
        require(
            block.timestamp >= currentReservation.checkInDate - 1 days &&
            block.timestamp < currentReservation.checkInDate,
            "Can only cede 1 day before check-in"
        );
        require(_bidIndex < auctionBids.length, "Invalid bid index");
        
        AuctionBid storage winningBid = auctionBids[_bidIndex];
        require(winningBid.isActive, "Bid not active");
        require(winningBid.amount > currentReservation.stakeAmount, "Bid must be higher than stake");
        
        // Calcular el valor adicional (diferencia)
        uint256 additionalValue = winningBid.amount - currentReservation.stakeAmount;
        
        // Calcular distribuciones (Citizen Value) SOLO sobre el valor adicional
        uint256 hotelAmount = (additionalValue * CITIZEN_HOTEL_PCT) / 100;
        uint256 ownerAmount = (additionalValue * CITIZEN_OWNER_PCT) / 100;
        uint256 digitalHouseAmount = (additionalValue * CITIZEN_DIGITALHOUSE_PCT) / 100;
        
        // Devolver stake original + valor ciudadano al booker original
        uint256 returnToOriginalBooker = currentReservation.stakeAmount + ownerAmount;
        require(
            pyusdToken.transfer(currentReservation.booker, returnToOriginalBooker),
            "Original booker payment failed"
        );
        
        // Distribuir el valor adicional inmediatamente según modelo de negocio
        require(pyusdToken.transfer(realEstateAddress, hotelAmount), "Hotel transfer failed");
        require(pyusdToken.transfer(digitalHouseAddress, digitalHouseAmount), "Digital House transfer failed");
        
        // Tokens restantes: winningBid.amount (nuevo stake para pago normal en checkIn)
        // Total distribuido: returnToOriginalBooker + hotelAmount + digitalHouseAmount
        // = 1,150 + 250 + 100 = 1,500
        // Restantes: 2,500 - 1,500 = 1,000 (el stake original que se paga como normal)
        
        // Actualizar reserva al nuevo booker con stake original (no la oferta completa)
        // porque el valor adicional ya se distribuyó
        address originalBooker = currentReservation.booker;
        currentReservation.booker = winningBid.bidder;
        currentReservation.stakeAmount = currentReservation.stakeAmount; // Mantener stake original (1,000)
        winningBid.isActive = false;
        
        // Devolver fondos a otros bidders
        _refundOtherBidders(_bidIndex);
        
        emit ReservationCeded(originalBooker, winningBid.bidder, winningBid.amount);
    }
    
    /**
     * @dev Check-in: pagar y obtener código de acceso
     */
    function checkIn() external nonReentrant returns (string memory accessCode) {
        require(msg.sender == currentReservation.booker, "Not the booker");
        require(currentState == VaultState.AUCTION, "Invalid state");
        require(
            block.timestamp >= currentReservation.checkInDate &&
            block.timestamp < currentReservation.checkInDate + 1 days,
            "Not check-in time"
        );
        
        // Distribuir pago (100% del stake)
        uint256 totalPayment = currentReservation.stakeAmount;
        uint256 realEstateAmount = (totalPayment * PAYMENT_REALESTATE_PCT) / 100;
        uint256 digitalHouseAmount = (totalPayment * PAYMENT_DIGITALHOUSE_PCT) / 100;
        
        require(
            pyusdToken.transfer(realEstateAddress, realEstateAmount),
            "Real estate transfer failed"
        );
        require(
            pyusdToken.transfer(digitalHouseAddress, digitalHouseAmount),
            "Digital house transfer failed"
        );
        
        // Generar código de 6 dígitos
        accessCode = _generateAccessCode(currentReservation.nonce);
        
        currentState = VaultState.SETTLED;
        
        emit CheckInCompleted(msg.sender, accessCode);
        return accessCode;
    }
    
    /**
     * @dev Check-out: finalizar contrato
     */
    function checkOut() external nonReentrant {
        require(msg.sender == currentReservation.booker, "Not the booker");
        require(currentState == VaultState.SETTLED, "Not in settled state");
        require(
            block.timestamp >= currentReservation.checkOutDate,
            "Not check-out time yet"
        );
        
        emit CheckOutCompleted(msg.sender, currentReservation.nonce);
        
        // Resetear vault para nueva reserva
        _resetVault();
    }
    
    /**
     * @dev Cancelar reserva antes del check-in (automático)
     */
    function cancelReservation() external nonReentrant {
        require(msg.sender == currentReservation.booker, "Not the booker");
        require(currentState == VaultState.AUCTION, "Invalid state");
        
        // Devolver stake
        require(
            pyusdToken.transfer(msg.sender, currentReservation.stakeAmount),
            "Transfer failed"
        );
        
        // Pasar al siguiente bidder si existe
        _moveToNextBidder();
    }
    
    // Funciones internas
    
    function _generateAccessCode(uint256 _nonce) internal view returns (string memory) {
        // Generar código único de 6 dígitos
        uint256 code = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            msg.sender,
            _nonce,
            vaultId
        ))) % 1000000;
        
        return _uint2str(code);
    }
    
    function _refundOtherBidders(uint256 _winningBidIndex) internal {
        for (uint256 i = 0; i < auctionBids.length; i++) {
            if (i != _winningBidIndex && auctionBids[i].isActive) {
                auctionBids[i].isActive = false;
                pyusdToken.transfer(auctionBids[i].bidder, auctionBids[i].amount);
            }
        }
    }
    
    function _moveToNextBidder() internal {
        if (auctionBids.length > 0) {
            // Encontrar la oferta más alta activa
            uint256 highestBidIndex = 0;
            uint256 highestAmount = 0;
            
            for (uint256 i = 0; i < auctionBids.length; i++) {
                if (auctionBids[i].isActive && auctionBids[i].amount > highestAmount) {
                    highestAmount = auctionBids[i].amount;
                    highestBidIndex = i;
                }
            }
            
            if (highestAmount > 0) {
                AuctionBid storage nextBid = auctionBids[highestBidIndex];
                currentReservation.booker = nextBid.bidder;
                currentReservation.stakeAmount = nextBid.amount;
                nextBid.isActive = false;
                
                // Devolver otros fondos
                _refundOtherBidders(highestBidIndex);
            } else {
                _resetVault();
            }
        } else {
            _resetVault();
        }
    }
    
    function _resetVault() internal {
        delete currentReservation;
        delete auctionBids;
        currentState = VaultState.FREE;
        currentNonce++;
    }
    
    function _uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) return "000000";
        
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        
        // Pad to 6 digits
        bytes memory bstr = new bytes(6);
        for (uint256 k = 0; k < 6; k++) {
            if (k < 6 - len) {
                bstr[k] = bytes1(uint8(48)); // '0'
            } else {
                bstr[k] = bytes1(uint8(48 + _i % 10));
                _i /= 10;
            }
        }
        return string(bstr);
    }
    
    // View functions
    
    function getAuctionBids() external view returns (AuctionBid[] memory) {
        return auctionBids;
    }
    
    function getCurrentReservation() external view returns (Reservation memory) {
        return currentReservation;
    }
    
    function getVaultInfo() external view returns (
        string memory,
        VaultState,
        uint256,
        uint256
    ) {
        return (vaultId, currentState, basePrice, currentNonce);
    }
}