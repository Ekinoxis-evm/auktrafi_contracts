// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./interfaces/IDigitalHouseFactory.sol";
import "./interfaces/IDigitalHouseVault.sol";

/**
 * @title DigitalHouseVault
 * @dev Contrato para gestionar reservas de propiedades con sistema de subastas
 * @notice Uses Clone pattern (EIP-1167) for gas-efficient deployment
 */
contract DigitalHouseVault is ReentrancyGuardUpgradeable, OwnableUpgradeable {
    
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
    uint256 public dailyBasePrice; // Changed from basePrice to dailyBasePrice
    uint256 public currentNonce;
    
    Reservation public currentReservation;
    AuctionBid[] public auctionBids;
    
    // Tracking de bookers para distribución
    address public originalBooker; // Primer usuario que hizo la reserva
    address public lastBooker; // Último usuario que cedió la reserva
    
    // Constantes de distribución - Base Price
    uint256 constant PAYMENT_REALESTATE_PCT = 95;
    uint256 constant PAYMENT_DIGITALHOUSE_PCT = 5;
    
    // Constantes de distribución - Additional Value (bid - base price)
    uint256 constant ADDITIONAL_CURRENT_BOOKER_PCT = 40; // Para quien hace check-in
    uint256 constant ADDITIONAL_LAST_BOOKER_PCT = 30;    // Para quien cedió la reserva
    uint256 constant ADDITIONAL_REALESTATE_PCT = 20;     // Para el dueño del vault
    uint256 constant ADDITIONAL_PLATFORM_PCT = 10;      // Para Digital House
    
    // Estructura para códigos de acceso
    struct AccessCode {
        string code;
        uint256 timestamp;
        address booker; // Guardar el booker para autorización posterior
        bool isActive;
    }
    
    // Storage privado para códigos de acceso
    mapping(uint256 => AccessCode) private accessCodes; // nonce => AccessCode
    uint256 public currentAccessCodeNonce;
    
    // Código de acceso predefinido por el propietario
    string public masterAccessCode; // Código maestro definido por el propietario
    
    // Direcciones de recepción
    address public realEstateAddress; // Parent vault address (receives payments) or address(0) for parent vaults
    address public digitalHouseAddress; // Digital House multisig
    address public factoryAddress; // Factory contract for state synchronization
    
    // Modifier para sincronizar estado con Factory
    modifier notifyStateChange() {
        _;
        if (factoryAddress != address(0)) {
            try IDigitalHouseFactory(factoryAddress).updateNightSubVaultState(
                address(this), 
                uint8(currentState)
            ) {} catch {
                // Silently fail if factory call fails to avoid blocking transactions
            }
        }
    }
    
    // Treasury management for parent vaults
    mapping(address => uint256) public earnings; // Track earnings per stakeholder
    uint256 public totalEarnings;
    
    // Eventos
    event ReservationCreated(address indexed booker, uint256 amount, uint256 checkInDate);
    event BidPlaced(address indexed bidder, uint256 amount);
    event BidWithdrawn(address indexed bidder, uint256 amount);
    event ReservationCeded(address indexed originalBooker, address indexed newBooker, uint256 amount);
    event CheckInCompleted(address indexed booker, string accessCode);
    event CheckOutCompleted(address indexed booker, uint256 nonce);
    event MasterAccessCodeUpdated(address indexed updatedBy, string newCode);
    event PaymentReceived(address indexed from, uint256 amount);
    event EarningsWithdrawn(address indexed recipient, uint256 amount);
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @dev Initialize the vault (replaces constructor for clone pattern)
     * @notice Called once after cloning to set up the vault
     */
    function initialize(
        address _pyusdToken,
        address _realEstateAddress,
        address _digitalHouseAddress,
        string memory _vaultId,
        string memory _propertyDetails,
        uint256 _dailyBasePrice,
        string memory _masterAccessCode
    ) external initializer {
        __ReentrancyGuard_init();
        __Ownable_init(msg.sender);
        
        pyusdToken = IERC20(_pyusdToken);
        realEstateAddress = _realEstateAddress;
        digitalHouseAddress = _digitalHouseAddress;
        vaultId = _vaultId;
        propertyDetails = _propertyDetails;
        dailyBasePrice = _dailyBasePrice;
        masterAccessCode = _masterAccessCode;
        currentState = VaultState.FREE;
        currentNonce = 1;
        factoryAddress = msg.sender; // Factory is the initializer
    }
    
    /**
     * @dev Crear reserva inicial con stake (para un día específico)
     */
    function createReservation(
        uint256 _stakeAmount,
        uint256 _checkInDate,
        uint256 _checkOutDate
    ) external nonReentrant notifyStateChange {
        require(currentState == VaultState.FREE, "Vault not available");
        require(_stakeAmount >= dailyBasePrice, "Stake below daily base price");
        require(_checkInDate > block.timestamp, "Check-in must be in future");
        // For daily sub-vaults, checkIn and checkOut should be the same day or consecutive
        require(_checkOutDate >= _checkInDate, "Invalid dates");
        
        // Transfer PYUSD stake
        require(
            pyusdToken.transferFrom(msg.sender, address(this), _stakeAmount),
            "Transfer failed"
        );
        
        // Establecer el booker original para distribución futura
        originalBooker = msg.sender;
        
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
    function placeBid(uint256 _bidAmount) external nonReentrant notifyStateChange {
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
    function cedeReservation(uint256 _bidIndex) external nonReentrant notifyStateChange {
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
        
        // Guardar el booker actual como lastBooker para distribución futura
        lastBooker = currentReservation.booker;
        
        // Solo devolver el stake original al booker que cede (sin distribución adicional)
        require(
            pyusdToken.transfer(currentReservation.booker, currentReservation.stakeAmount),
            "Stake refund failed"
        );
        
        // Actualizar reserva al nuevo booker con el monto COMPLETO del bid
        // La distribución del valor adicional se hará en checkIn()
        address previousBooker = currentReservation.booker;
        currentReservation.booker = winningBid.bidder;
        currentReservation.stakeAmount = winningBid.amount; // Usar el monto completo del bid
        winningBid.isActive = false;
        
        // Devolver fondos a otros bidders
        _refundOtherBidders(_bidIndex);
        
        emit ReservationCeded(previousBooker, winningBid.bidder, winningBid.amount);
    }
    
    /**
     * @dev Check-in: pagar y obtener código de acceso
     */
    function checkIn() external nonReentrant notifyStateChange returns (string memory accessCode) {
        require(msg.sender == currentReservation.booker, "Not the booker");
        require(currentState == VaultState.AUCTION, "Invalid state");
        require(
            block.timestamp >= currentReservation.checkInDate &&
            block.timestamp < currentReservation.checkInDate + 1 days,
            "Not check-in time"
        );
        
        // Nueva lógica de distribución de pagos
        uint256 totalPayment = currentReservation.stakeAmount;
        bool isSubVault = realEstateAddress != address(0); // Sub-vault if parent vault address is set
        
        if (totalPayment > dailyBasePrice) {
            // Hay valor adicional - aplicar nueva distribución
            uint256 basePortion = dailyBasePrice;
            uint256 additionalValue = totalPayment - dailyBasePrice;
            
            // Distribución del precio base (95% + 5%)
            uint256 baseRealEstateAmount = (basePortion * PAYMENT_REALESTATE_PCT) / 100;
            uint256 baseDigitalHouseAmount = (basePortion * PAYMENT_DIGITALHOUSE_PCT) / 100;
            
            // Distribución del valor adicional (40% + 30% + 20% + 10%)
            uint256 currentBookerAmount = (additionalValue * ADDITIONAL_CURRENT_BOOKER_PCT) / 100;
            uint256 lastBookerAmount = (additionalValue * ADDITIONAL_LAST_BOOKER_PCT) / 100;
            uint256 additionalRealEstateAmount = (additionalValue * ADDITIONAL_REALESTATE_PCT) / 100;
            uint256 additionalPlatformAmount = (additionalValue * ADDITIONAL_PLATFORM_PCT) / 100;
            
            if (isSubVault) {
                // Sub-vault: Send to parent vault via receivePayment()
                uint256 totalRealEstateAmount = baseRealEstateAmount + additionalRealEstateAmount;
                if (lastBooker == address(0)) {
                    totalRealEstateAmount += lastBookerAmount; // Add lastBooker share if no lastBooker
                }
                
                // Approve parent vault to pull funds
                pyusdToken.approve(realEstateAddress, totalRealEstateAmount);
                
                // Call parent vault's receivePayment
                IDigitalHouseVault(realEstateAddress).receivePayment(totalRealEstateAmount);
                
                // Direct transfers for platform, bookers
                require(
                    pyusdToken.transfer(digitalHouseAddress, baseDigitalHouseAmount + additionalPlatformAmount),
                    "Digital house transfer failed"
                );
                require(
                    pyusdToken.transfer(msg.sender, currentBookerAmount),
                    "Current booker transfer failed"
                );
                
                if (lastBooker != address(0)) {
                    require(
                        pyusdToken.transfer(lastBooker, lastBookerAmount),
                        "Last booker transfer failed"
                    );
                }
            } else {
                // Parent vault: Direct transfers to owner (for testing/legacy support)
                address recipient = realEstateAddress == address(0) ? owner() : realEstateAddress;
                require(
                    pyusdToken.transfer(recipient, baseRealEstateAmount + additionalRealEstateAmount),
                    "Real estate transfer failed"
                );
                require(
                    pyusdToken.transfer(digitalHouseAddress, baseDigitalHouseAmount + additionalPlatformAmount),
                    "Digital house transfer failed"
                );
                require(
                    pyusdToken.transfer(msg.sender, currentBookerAmount),
                    "Current booker transfer failed"
                );
                
                if (lastBooker != address(0)) {
                    require(
                        pyusdToken.transfer(lastBooker, lastBookerAmount),
                        "Last booker transfer failed"
                    );
                } else {
                    require(
                        pyusdToken.transfer(recipient, lastBookerAmount),
                        "Additional real estate transfer failed"
                    );
                }
            }
            
        } else {
            // Solo precio base - distribución normal (95% + 5%)
            uint256 realEstateAmount = (totalPayment * PAYMENT_REALESTATE_PCT) / 100;
            uint256 digitalHouseAmount = (totalPayment * PAYMENT_DIGITALHOUSE_PCT) / 100;
            
            if (isSubVault) {
                // Sub-vault: Send to parent vault
                pyusdToken.approve(realEstateAddress, realEstateAmount);
                IDigitalHouseVault(realEstateAddress).receivePayment(realEstateAmount);
                
                require(
                    pyusdToken.transfer(digitalHouseAddress, digitalHouseAmount),
                    "Digital house transfer failed"
                );
            } else {
                // Parent vault: Direct transfers to owner (for testing/legacy support)
                address recipient = realEstateAddress == address(0) ? owner() : realEstateAddress;
                require(
                    pyusdToken.transfer(recipient, realEstateAmount),
                    "Real estate transfer failed"
                );
                require(
                    pyusdToken.transfer(digitalHouseAddress, digitalHouseAmount),
                    "Digital house transfer failed"
                );
            }
        }
        
        // Usar código maestro predefinido
        accessCode = masterAccessCode;
        currentAccessCodeNonce = currentReservation.nonce;
        
        accessCodes[currentReservation.nonce] = AccessCode({
            code: accessCode,
            timestamp: block.timestamp,
            booker: msg.sender,
            isActive: true
        });
        
        currentState = VaultState.SETTLED;
        
        emit CheckInCompleted(msg.sender, accessCode);
        return accessCode;
    }
    
    /**
     * @dev Check-out: finalizar contrato
     */
    function checkOut() external nonReentrant notifyStateChange {
        require(msg.sender == currentReservation.booker, "Not the booker");
        require(currentState == VaultState.SETTLED, "Not in settled state");
        require(
            block.timestamp >= currentReservation.checkOutDate,
            "Not check-out time yet"
        );
        
        // Invalidar código de acceso
        if (accessCodes[currentAccessCodeNonce].isActive) {
            accessCodes[currentAccessCodeNonce].isActive = false;
        }
        
        emit CheckOutCompleted(msg.sender, currentReservation.nonce);
        
        // Resetear vault para nueva reserva
        _resetVault();
    }
    
    /**
     * @dev Cancelar reserva antes del check-in (automático)
     */
    function cancelReservation() external nonReentrant notifyStateChange {
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
    
    /**
     * @dev Actualizar código maestro de acceso (solo propietario del vault)
     */
    function updateMasterAccessCode(string memory _newCode) external {
        require(
            msg.sender == realEstateAddress || msg.sender == owner(),
            "Only vault owner can update access code"
        );
        require(bytes(_newCode).length >= 4 && bytes(_newCode).length <= 12, "Code must be 4-12 characters");
        
        masterAccessCode = _newCode;
        emit MasterAccessCodeUpdated(msg.sender, _newCode);
    }
    
    /**
     * @dev Obtener código maestro de acceso (solo usuarios autorizados)
     */
    function getMasterAccessCode() external view returns (string memory) {
        require(
            msg.sender == realEstateAddress || 
            msg.sender == owner() ||
            (currentState == VaultState.SETTLED && msg.sender == currentReservation.booker),
            "Not authorized to view master access code"
        );
        
        return masterAccessCode;
    }
    
    /**
     * @dev Obtener código de acceso actual (solo usuarios autorizados)
     */
    function getCurrentAccessCode() external view returns (string memory) {
        require(currentAccessCodeNonce > 0, "No access code generated yet");
        
        AccessCode storage currentCode = accessCodes[currentAccessCodeNonce];
        require(
            msg.sender == currentCode.booker || 
            msg.sender == owner() || 
            msg.sender == realEstateAddress,
            "Not authorized to view access code"
        );
        require(currentCode.isActive, "No active access code");
        
        return currentCode.code;
    }
    
    /**
     * @dev Obtener código de acceso por nonce (solo usuarios autorizados)
     */
    function getAccessCode(uint256 _nonce) external view returns (string memory) {
        require(accessCodes[_nonce].booker != address(0), "Access code does not exist");
        require(accessCodes[_nonce].isActive, "Access code not active");
        
        AccessCode storage codeData = accessCodes[_nonce];
        require(
            msg.sender == codeData.booker || 
            msg.sender == owner() || 
            msg.sender == realEstateAddress,
            "Not authorized to view access code"
        );
        
        return codeData.code;
    }
    
    /**
     * @dev Verificar si un código de acceso está activo
     */
    function isAccessCodeActive(uint256 _nonce) external view returns (bool) {
        require(accessCodes[_nonce].booker != address(0), "Access code does not exist");
        
        AccessCode storage codeData = accessCodes[_nonce];
        require(
            msg.sender == codeData.booker || 
            msg.sender == owner() || 
            msg.sender == realEstateAddress,
            "Not authorized"
        );
        
        return codeData.isActive;
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
        
        // Resetear tracking de bookers para nueva reserva
        originalBooker = address(0);
        lastBooker = address(0);
        // No resetear currentAccessCodeNonce para mantener referencia al último código generado
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
        return (vaultId, currentState, dailyBasePrice, currentNonce);
    }
    
    // ========== TREASURY FUNCTIONS (for parent vaults) ==========
    
    /**
     * @dev Receive payment from sub-vault (only callable by sub-vaults)
     */
    function receivePayment(uint256 amount) external {
        require(msg.sender != address(0), "Invalid sender");
        
        // Transfer PYUSD from sub-vault to this parent vault
        pyusdToken.transferFrom(msg.sender, address(this), amount);
        
        // Track earnings for vault owner
        earnings[owner()] += amount;
        totalEarnings += amount;
        
        emit PaymentReceived(msg.sender, amount);
    }
    
    /**
     * @dev Withdraw earnings (only vault owner)
     */
    function withdrawEarnings() external nonReentrant {
        require(msg.sender == owner(), "Only vault owner");
        uint256 amount = earnings[msg.sender];
        require(amount > 0, "No earnings to withdraw");
        
        earnings[msg.sender] = 0;
        pyusdToken.transfer(msg.sender, amount);
        
        emit EarningsWithdrawn(msg.sender, amount);
    }
    
    /**
     * @dev Get earnings balance for caller
     */
    function getEarningsBalance() external view returns (uint256) {
        return earnings[msg.sender];
    }
    
    /**
     * @dev Get total earnings accumulated in vault
     */
    function getTotalEarnings() external view returns (uint256) {
        return totalEarnings;
    }
}