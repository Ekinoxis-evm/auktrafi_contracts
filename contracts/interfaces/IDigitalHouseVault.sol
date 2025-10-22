// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IDigitalHouseVault
 * @dev Interface for Digital House Vault contract with auction system
 */
interface IDigitalHouseVault {

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

    // Eventos
    event ReservationCreated(address indexed booker, uint256 amount, uint256 checkInDate);
    event BidPlaced(address indexed bidder, uint256 amount);
    event BidWithdrawn(address indexed bidder, uint256 amount);
    event ReservationCeded(address indexed originalBooker, address indexed newBooker, uint256 amount);
    event CheckInCompleted(address indexed booker, string accessCode);
    event CheckOutCompleted(address indexed booker, uint256 nonce);

    // Funciones de gestión de reservas
    function createReservation(
        uint256 _stakeAmount,
        uint256 _checkInDate,
        uint256 _checkOutDate
    ) external;

    function cancelReservation() external;

    function getCurrentReservation() external view returns (Reservation memory);

    // Funciones de subasta
    function placeBid(uint256 _bidAmount) external;

    function withdrawBid(uint256 _bidIndex) external;

    function cedeReservation(uint256 _bidIndex) external;

    function getAuctionBids() external view returns (AuctionBid[] memory);

    // Funciones de check-in/check-out
    function checkIn() external;

    function checkOut() external;

    // Funciones de vista
    function getVaultInfo() external view returns (
        VaultState state,
        uint256 price,
        uint256 nonce
    );

    function currentState() external view returns (VaultState);

    function getAccessCode() external view returns (string memory);

    // Variables públicas
    function vaultId() external view returns (string memory);
    function propertyDetails() external view returns (string memory);
    function basePrice() external view returns (uint256);
    function currentNonce() external view returns (uint256);
    function pyusdToken() external view returns (address);
    function realEstateAddress() external view returns (address);
    function digitalHouseAddress() external view returns (address);
    function convexoAddress() external view returns (address);
}
