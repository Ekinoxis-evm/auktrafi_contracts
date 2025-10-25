// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./DigitalHouseVault.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title DigitalHouseFactory
 * @dev Factory for night-by-night booking management with owner-controlled availability
 */
contract DigitalHouseFactory is Ownable {
    
    struct VaultInfo {
        address vaultAddress;
        string vaultId;
        string propertyDetails;
        uint256 nightPrice; // Price per night (2 PM to 12 PM next day)
        uint256 createdAt;
        bool isActive;
    }
    
    struct NightSubVaultInfo {
        address subVaultAddress;
        string subVaultId;
        uint256 nightDate; // Simple night identifier (day number)
        VaultState currentState;
        uint256 nightPrice;
        uint256 createdAt;
    }
    
    enum VaultState { FREE, AUCTION, SETTLED }
    
    // Storage
    mapping(string => VaultInfo) public vaults;
    mapping(address => string[]) public ownerVaults;
    string[] public allVaultIds;
    
    mapping(string => NightSubVaultInfo[]) private parentNightSubVaults;
    mapping(string => mapping(uint256 => address)) public nightVaults;
    mapping(address => string) public subVaultToParent;
    
    // Availability Management
    mapping(string => mapping(uint256 => bool)) public nightAvailability; // vaultId => nightTimestamp => isAvailable
    
    address public pyusdToken;
    address public digitalHouseAddress;
    
    // Events
    event VaultCreated(string indexed vaultId, address indexed vaultAddress, address indexed owner, uint256 nightPrice);
    event NightVaultCreated(string indexed parentVaultId, string indexed subVaultId, address indexed subVaultAddress, uint256 nightDate, uint256 nightPrice);
    event NightSubVaultStateUpdated(string indexed parentVaultId, address indexed subVaultAddress, uint256 nightDate, VaultState newState);
    event NightAvailabilitySet(string indexed vaultId, uint256 nightDate, bool isAvailable);
    event AvailabilityWindowSet(string indexed vaultId, uint256 startNight, uint256 endNight);
    
    constructor(address _pyusdToken, address _digitalHouseAddress) Ownable(msg.sender) {
        pyusdToken = _pyusdToken;
        digitalHouseAddress = _digitalHouseAddress;
    }
    
    function createVault(
        string memory _vaultId,
        string memory _propertyDetails,
        uint256 _nightPrice,
        string memory _masterAccessCode
    ) external returns (address) {
        require(bytes(_vaultId).length > 0 && vaults[_vaultId].vaultAddress == address(0), "ID");
        require(_nightPrice > 0, "P");
        require(bytes(_masterAccessCode).length >= 4 && bytes(_masterAccessCode).length <= 12, "C");
        
        DigitalHouseVault newVault = new DigitalHouseVault(
            pyusdToken,
            address(0),
            digitalHouseAddress,
            _vaultId,
            _propertyDetails,
            _nightPrice,
            _masterAccessCode
        );
        
        address vaultAddress = address(newVault);
        newVault.transferOwnership(msg.sender);
        
        vaults[_vaultId] = VaultInfo({
            vaultAddress: vaultAddress,
            vaultId: _vaultId,
            propertyDetails: _propertyDetails,
            nightPrice: _nightPrice,
            createdAt: block.timestamp,
            isActive: true
        });
        
        ownerVaults[msg.sender].push(_vaultId);
        allVaultIds.push(_vaultId);
        
        emit VaultCreated(_vaultId, vaultAddress, msg.sender, _nightPrice);
        return vaultAddress;
    }
    
    function setNightAvailability(string memory _vaultId, uint256 _nightDate, bool _isAvailable) external {
        require(msg.sender == Ownable(vaults[_vaultId].vaultAddress).owner(), "Not owner");
        nightAvailability[_vaultId][_nightDate] = _isAvailable;
        emit NightAvailabilitySet(_vaultId, _nightDate, _isAvailable);
    }
    
    function setAvailabilityWindow(string memory _vaultId, uint256 _startNight, uint256 _endNight, uint256 _nightCount) external {
        require(msg.sender == Ownable(vaults[_vaultId].vaultAddress).owner() && _nightCount > 0 && _nightCount <= 365, "Invalid");
        for (uint256 i = 0; i < _nightCount; i++) nightAvailability[_vaultId][_startNight + i] = true;
        emit AvailabilityWindowSet(_vaultId, _startNight, _endNight);
    }
    
    function getNightAvailability(string memory _vaultId, uint256 _nightDate) external view returns (bool) {
        return nightAvailability[_vaultId][_nightDate];
    }
    
    function getNightSubVaultsInfo(string memory parentVaultId) public view returns (NightSubVaultInfo[] memory) {
        return parentNightSubVaults[parentVaultId];
    }
    
    function getNightSubVault(string memory parentVaultId, uint256 nightDate) public view returns (address) {
        return nightVaults[parentVaultId][nightDate];
    }
    
    function getOrCreateNightVault(
        string memory _vaultId,
        uint256 _nightDate,
        string memory _masterAccessCode
    ) external returns (address subVaultAddress) {
        require(vaults[_vaultId].isActive, "A");
        require(_nightDate > 0, "D");
        require(nightAvailability[_vaultId][_nightDate], "N");
        
        subVaultAddress = nightVaults[_vaultId][_nightDate];
        if (subVaultAddress != address(0)) {
            return subVaultAddress;
        }
        
        VaultInfo memory parentVault = vaults[_vaultId];
        require(parentVault.vaultAddress != address(0), "P");
        
        string memory subVaultId = string(abi.encodePacked(_vaultId, "_n", Strings.toString(_nightDate)));
        
        // Sub-vault payments go to parent vault address
        DigitalHouseVault newSubVault = new DigitalHouseVault(
            pyusdToken,
            parentVault.vaultAddress, // Parent vault receives payments
            digitalHouseAddress,
            subVaultId,
            parentVault.propertyDetails,
            parentVault.nightPrice,
            _masterAccessCode
        );
        
        subVaultAddress = address(newSubVault);
        
        nightVaults[_vaultId][_nightDate] = subVaultAddress;
        subVaultToParent[subVaultAddress] = _vaultId;
        
        parentNightSubVaults[_vaultId].push(NightSubVaultInfo({
            subVaultAddress: subVaultAddress,
            subVaultId: subVaultId,
            nightDate: _nightDate,
            currentState: VaultState.FREE,
            nightPrice: parentVault.nightPrice,
            createdAt: block.timestamp
        }));
        
        emit NightVaultCreated(_vaultId, subVaultId, subVaultAddress, _nightDate, parentVault.nightPrice);
        return subVaultAddress;
    }
    
    function updateNightSubVaultState(address subVaultAddress, uint8 newState) external {
        string memory parentVaultId = subVaultToParent[subVaultAddress];
        require(bytes(parentVaultId).length > 0, "F");
        
        NightSubVaultInfo[] storage subVaults = parentNightSubVaults[parentVaultId];
        for (uint256 i = 0; i < subVaults.length; i++) {
            if (subVaults[i].subVaultAddress == subVaultAddress) {
                subVaults[i].currentState = VaultState(newState);
                emit NightSubVaultStateUpdated(parentVaultId, subVaultAddress, subVaults[i].nightDate, VaultState(newState));
                break;
            }
        }
    }
    
    function getVaultAddress(string memory _vaultId) external view returns (address) {
        return vaults[_vaultId].vaultAddress;
    }
    
    function getVaultInfo(string memory _vaultId) external view returns (VaultInfo memory) {
        return vaults[_vaultId];
    }
    
    function getOwnerVaults(address _owner) external view returns (string[] memory) {
        return ownerVaults[_owner];
    }
    
    function getAllVaultIds() external view returns (string[] memory) {
        return allVaultIds;
    }
}
