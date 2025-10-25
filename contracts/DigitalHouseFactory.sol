// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./DigitalHouseVault.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title DigitalHouseFactory
 * @dev Factory para crear y gestionar múltiples vaults de Digital House
 */
contract DigitalHouseFactory is Ownable {
    
    // Estructura de información de vault
    struct VaultInfo {
        address vaultAddress;
        address realEstateAddress;
        string vaultId;
        string propertyDetails;
        uint256 basePrice;
        uint256 createdAt;
        bool isActive;
    }
    
    // Mapeo de vaults principales
    mapping(string => VaultInfo) public vaults;
    mapping(address => string[]) public ownerVaults;
    string[] public allVaultIds;
    
    // Sistema de sub-vaults para fechas específicas
    mapping(string => mapping(bytes32 => address)) public dateVaults; // parentVaultId => dateHash => subVaultAddress
    mapping(string => mapping(bytes32 => bool)) public dateAvailability; // parentVaultId => dateHash => isAvailable
    mapping(address => string) public subVaultToParent; // subVaultAddress => parentVaultId
    
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
    event DateVaultCreated(
        string indexed parentVaultId,
        string indexed subVaultId,
        address indexed subVaultAddress,
        uint256 checkInDate,
        uint256 checkOutDate
    );
    event DateAvailabilityUpdated(
        string indexed vaultId,
        uint256 checkInDate,
        uint256 checkOutDate,
        bool isAvailable
    );
    
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
        address _realEstateAddress,
        string memory _masterAccessCode
    ) external returns (address) {
        require(bytes(_vaultId).length > 0, "Vault ID required");
        require(vaults[_vaultId].vaultAddress == address(0), "Vault ID already exists");
        require(_basePrice > 0, "Base price must be > 0");
        require(bytes(_masterAccessCode).length >= 4 && bytes(_masterAccessCode).length <= 12, "Access code must be 4-12 characters");
        
        // Crear nuevo vault
        DigitalHouseVault newVault = new DigitalHouseVault(
            pyusdToken,
            _realEstateAddress,
            digitalHouseAddress,
            _vaultId,
            _propertyDetails,
            _basePrice,
            _masterAccessCode
        );
        
        address vaultAddress = address(newVault);
        
        // Guardar información
        vaults[_vaultId] = VaultInfo({
            vaultAddress: vaultAddress,
            realEstateAddress: _realEstateAddress,
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
    
    // ========== SISTEMA DE SUB-VAULTS PARA FECHAS ESPECÍFICAS ==========
    
    /**
     * @dev Obtener o crear sub-vault para fechas específicas
     */
    function getOrCreateDateVault(
        string memory _parentVaultId,
        uint256 _checkInDate,
        uint256 _checkOutDate
    ) external returns (address) {
        require(vaults[_parentVaultId].isActive, "Parent vault not active");
        require(_checkInDate > block.timestamp, "Check-in must be in future");
        require(_checkOutDate > _checkInDate, "Invalid date range");
        
        bytes32 dateHash = _generateDateHash(_checkInDate, _checkOutDate);
        
        // Si ya existe el sub-vault, devolverlo
        if (dateVaults[_parentVaultId][dateHash] != address(0)) {
            return dateVaults[_parentVaultId][dateHash];
        }
        
        // Verificar que las fechas no se solapen con reservas existentes
        require(_isDateRangeAvailable(_parentVaultId, _checkInDate, _checkOutDate), "Date range not available");
        
        // Crear sub-vault ID único
        string memory subVaultId = string(abi.encodePacked(
            _parentVaultId, "-", 
            Strings.toString(_checkInDate), "-", 
            Strings.toString(_checkOutDate)
        ));
        
        // Obtener información del vault padre
        VaultInfo storage parentInfo = vaults[_parentVaultId];
        
        // Crear nuevo sub-vault
        DigitalHouseVault subVault = new DigitalHouseVault(
            pyusdToken,
            parentInfo.realEstateAddress,
            digitalHouseAddress,
            subVaultId,
            parentInfo.propertyDetails,
            parentInfo.basePrice,
            _getParentMasterAccessCode(_parentVaultId)
        );
        
        address subVaultAddress = address(subVault);
        
        // Registrar el sub-vault
        dateVaults[_parentVaultId][dateHash] = subVaultAddress;
        subVaultToParent[subVaultAddress] = _parentVaultId;
        dateAvailability[_parentVaultId][dateHash] = false; // Marcar como ocupado
        
        emit DateVaultCreated(_parentVaultId, subVaultId, subVaultAddress, _checkInDate, _checkOutDate);
        
        return subVaultAddress;
    }
    
    /**
     * @dev Verificar si un rango de fechas está disponible
     */
    function isDateRangeAvailable(
        string memory _vaultId,
        uint256 _checkInDate,
        uint256 _checkOutDate
    ) external view returns (bool) {
        return _isDateRangeAvailable(_vaultId, _checkInDate, _checkOutDate);
    }
    
    /**
     * @dev Obtener sub-vault para fechas específicas (si existe)
     */
    function getDateVault(
        string memory _parentVaultId,
        uint256 _checkInDate,
        uint256 _checkOutDate
    ) external view returns (address) {
        bytes32 dateHash = _generateDateHash(_checkInDate, _checkOutDate);
        return dateVaults[_parentVaultId][dateHash];
    }
    
    /**
     * @dev Obtener vault padre de un sub-vault
     */
    function getParentVault(address _subVaultAddress) external view returns (string memory) {
        return subVaultToParent[_subVaultAddress];
    }
    
    /**
     * @dev Liberar fechas cuando se completa una reserva (llamado por el sub-vault)
     */
    function releaseDateRange(
        string memory _parentVaultId,
        uint256 _checkInDate,
        uint256 _checkOutDate
    ) external {
        // Solo el sub-vault puede liberar sus fechas
        bytes32 dateHash = _generateDateHash(_checkInDate, _checkOutDate);
        require(dateVaults[_parentVaultId][dateHash] == msg.sender, "Only sub-vault can release dates");
        
        dateAvailability[_parentVaultId][dateHash] = true;
        emit DateAvailabilityUpdated(_parentVaultId, _checkInDate, _checkOutDate, true);
    }
    
    // ========== FUNCIONES INTERNAS ==========
    
    /**
     * @dev Generar hash único para un rango de fechas
     */
    function _generateDateHash(uint256 _checkInDate, uint256 _checkOutDate) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(_checkInDate, _checkOutDate));
    }
    
    /**
     * @dev Verificar si un rango de fechas está disponible (interno)
     */
    function _isDateRangeAvailable(
        string memory _vaultId,
        uint256 _checkInDate,
        uint256 _checkOutDate
    ) internal view returns (bool) {
        require(vaults[_vaultId].isActive, "Vault not active");
        
        // Por ahora, implementación simple: verificar si ya existe un sub-vault para estas fechas exactas
        bytes32 dateHash = _generateDateHash(_checkInDate, _checkOutDate);
        
        // Si no existe sub-vault para estas fechas, está disponible
        if (dateVaults[_vaultId][dateHash] == address(0)) {
            return true;
        }
        
        // Si existe pero está marcado como disponible (reserva completada), también está disponible
        return dateAvailability[_vaultId][dateHash];
    }
    
    /**
     * @dev Obtener código maestro del vault padre
     */
    function _getParentMasterAccessCode(string memory _parentVaultId) internal view returns (string memory) {
        address parentVaultAddress = vaults[_parentVaultId].vaultAddress;
        DigitalHouseVault parentVault = DigitalHouseVault(parentVaultAddress);
        return parentVault.masterAccessCode();
    }
}