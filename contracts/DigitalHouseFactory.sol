// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./DigitalHouseVault.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DigitalHouseFactory
 * @dev Factory para crear y gestionar múltiples vaults de Digital House
 */
contract DigitalHouseFactory is Ownable {
    
    // Estructura de información de vault
    struct VaultInfo {
        address vaultAddress;
        string vaultId;
        string propertyDetails;
        uint256 basePrice;
        uint256 createdAt;
        bool isActive;
    }
    
    // Mapeo de vaults
    mapping(string => VaultInfo) public vaults;
    mapping(address => string[]) public ownerVaults;
    string[] public allVaultIds;
    
    // Direcciones globales
    address public pyusdToken;
    address public realEstateAddress; // Default hotel address
    address public digitalHouseAddress; // Digital House multisig
    
    // Eventos
    event VaultCreated(
        string indexed vaultId,
        address indexed vaultAddress,
        address indexed owner,
        uint256 basePrice
    );
    event VaultDeactivated(string indexed vaultId);
    
    constructor(
        address _pyusdToken,
        address _digitalHouseAddress
    ) Ownable(msg.sender) {
        pyusdToken = _pyusdToken;
        digitalHouseAddress = _digitalHouseAddress;
    }
    
    /**
     * @dev Crear nuevo vault para una propiedad
     */
    function createVault(
        string memory _vaultId,
        string memory _propertyDetails,
        uint256 _basePrice,
        address _realEstateAddress
    ) external returns (address) {
        require(bytes(_vaultId).length > 0, "Vault ID required");
        require(vaults[_vaultId].vaultAddress == address(0), "Vault ID already exists");
        require(_basePrice > 0, "Base price must be > 0");
        
        // Crear nuevo vault
        DigitalHouseVault newVault = new DigitalHouseVault(
            pyusdToken,
            _realEstateAddress,
            digitalHouseAddress,
            _vaultId,
            _propertyDetails,
            _basePrice
        );
        
        address vaultAddress = address(newVault);
        
        // Guardar información
        vaults[_vaultId] = VaultInfo({
            vaultAddress: vaultAddress,
            vaultId: _vaultId,
            propertyDetails: _propertyDetails,
            basePrice: _basePrice,
            createdAt: block.timestamp,
            isActive: true
        });
        
        ownerVaults[msg.sender].push(_vaultId);
        allVaultIds.push(_vaultId);
        
        emit VaultCreated(_vaultId, vaultAddress, msg.sender, _basePrice);
        
        return vaultAddress;
    }
    
    /**
     * @dev Desactivar vault
     */
    function deactivateVault(string memory _vaultId) external onlyOwner {
        require(vaults[_vaultId].isActive, "Vault not active");
        
        vaults[_vaultId].isActive = false;
        
        emit VaultDeactivated(_vaultId);
    }
    
    /**
     * @dev Obtener dirección de vault por ID
     */
    function getVaultAddress(string memory _vaultId) external view returns (address) {
        return vaults[_vaultId].vaultAddress;
    }
    
    /**
     * @dev Obtener información completa de vault
     */
    function getVaultInfo(string memory _vaultId) external view returns (VaultInfo memory) {
        return vaults[_vaultId];
    }
    
    /**
     * @dev Obtener todos los vaults de un owner
     */
    function getOwnerVaults(address _owner) external view returns (string[] memory) {
        return ownerVaults[_owner];
    }
    
    /**
     * @dev Obtener todos los vault IDs
     */
    function getAllVaultIds() external view returns (string[] memory) {
        return allVaultIds;
    }
    
    /**
     * @dev Actualizar direcciones globales
     */
    function updateAddresses(
        address _pyusdToken,
        address _realEstateAddress,
        address _digitalHouseAddress
    ) external onlyOwner {
        pyusdToken = _pyusdToken;
        realEstateAddress = _realEstateAddress;
        digitalHouseAddress = _digitalHouseAddress;
    }
}