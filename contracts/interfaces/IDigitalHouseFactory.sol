// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IDigitalHouseFactory
 * @dev Interface for Digital House Factory contract
 */
interface IDigitalHouseFactory {

    // Estructura de información de vault
    struct VaultInfo {
        address vaultAddress;
        string vaultId;
        string propertyDetails;
        uint256 basePrice;
        uint256 createdAt;
        bool isActive;
    }

    // Eventos
    event VaultCreated(
        string indexed vaultId,
        address indexed vaultAddress,
        address indexed owner,
        uint256 basePrice
    );
    event VaultDeactivated(string indexed vaultId);

    // Funciones
    function createVault(
        string memory _vaultId,
        string memory _propertyDetails,
        uint256 _basePrice
    ) external returns (address);

    function deactivateVault(string memory _vaultId) external;

    function getVaultAddress(string memory _vaultId) external view returns (address);

    function getVaultInfo(string memory _vaultId) external view returns (VaultInfo memory);

    function getOwnerVaults(address _owner) external view returns (string[] memory);

    function getAllVaultIds() external view returns (string[] memory);

    function updateAddresses(
        address _pyusdToken,
        address _realEstateAddress,
        address _digitalHouseAddress,
        address _convexoAddress
    ) external;

    // Variables públicas
    function pyusdToken() external view returns (address);
    function realEstateAddress() external view returns (address);
    function digitalHouseAddress() external view returns (address);
    function convexoAddress() external view returns (address);
}
