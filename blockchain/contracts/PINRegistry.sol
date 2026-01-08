// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

/**
 * @title PINRegistry
 * @notice Stores and verifies PIN hashes for ZKPulse customers
 * @dev PIN hashes are stored on-chain for persistence and multi-instance consistency
 */

contract PINRegistry {
    
    // PIN Registry: customerId -> {pinHash, salt, registeredAt}
    struct PINData {
        bytes32 pinHash;      // Hash of customer's PIN
        bytes32 salt;         // Salt used for hashing
        uint256 registeredAt; // Timestamp of registration
        bool exists;          // Whether this PIN is registered
    }
    
    // Mapping from keccak256(customerId) to PINData
    mapping(bytes32 => PINData) public pinRegistry;
    
    // Track registered customers
    bytes32[] public registeredCustomers;
    
    // Events
    event PINRegistered(bytes32 indexed customerIdHash, address indexed registrant, uint256 timestamp);
    event PINVerified(bytes32 indexed customerIdHash, uint256 timestamp);
    event PINUpdated(bytes32 indexed customerIdHash, uint256 timestamp);
    
    /**
     * @notice Register or update a customer's PIN hash
     * @param _customerId The customer ID (will be hashed for storage)
     * @param _pinHash The hash of the customer's PIN
     * @param _salt The salt used for hashing
     */
    function registerPIN(
        string calldata _customerId,
        bytes32 _pinHash,
        bytes32 _salt
    ) external {
        require(bytes(_customerId).length > 0, "Customer ID cannot be empty");
        require(_pinHash != bytes32(0), "PIN hash cannot be zero");
        
        bytes32 customerIdHash = keccak256(abi.encodePacked(_customerId));
        bool isUpdate = pinRegistry[customerIdHash].exists;
        
        pinRegistry[customerIdHash] = PINData({
            pinHash: _pinHash,
            salt: _salt,
            registeredAt: block.timestamp,
            exists: true
        });
        
        // Track new customers only
        if (!isUpdate) {
            registeredCustomers.push(customerIdHash);
            emit PINRegistered(customerIdHash, msg.sender, block.timestamp);
        } else {
            emit PINUpdated(customerIdHash, block.timestamp);
        }
    }
    
    /**
     * @notice Verify if a customer's PIN hash matches the registered one
     * @param _customerId The customer ID
     * @param _claimedPinHash The PIN hash to verify
     * @return valid Whether the PIN hash is correct
     * @return salt The salt used for hashing
     */
    function verifyPIN(
        string calldata _customerId,
        bytes32 _claimedPinHash
    ) external returns (bool valid, bytes32 salt) {
        bytes32 customerIdHash = keccak256(abi.encodePacked(_customerId));
        PINData storage pinData = pinRegistry[customerIdHash];
        
        require(pinData.exists, "PIN not registered for this customer");
        
        valid = (pinData.pinHash == _claimedPinHash);
        salt = pinData.salt;
        
        if (valid) {
            emit PINVerified(customerIdHash, block.timestamp);
        }
        
        return (valid, salt);
    }
    
    /**
     * @notice Check if a customer has a registered PIN
     * @param _customerId The customer ID
     * @return Whether the PIN is registered
     */
    function isPINRegistered(string calldata _customerId) external view returns (bool) {
        bytes32 customerIdHash = keccak256(abi.encodePacked(_customerId));
        return pinRegistry[customerIdHash].exists;
    }
    
    /**
     * @notice Get the salt for a customer's PIN (for ZK proof generation)
     * @param _customerId The customer ID
     * @return The salt
     */
    function getSalt(string calldata _customerId) external view returns (bytes32) {
        bytes32 customerIdHash = keccak256(abi.encodePacked(_customerId));
        require(pinRegistry[customerIdHash].exists, "PIN not registered");
        return pinRegistry[customerIdHash].salt;
    }
    
    /**
     * @notice Get registration timestamp for a customer
     * @param _customerId The customer ID
     * @return The registration timestamp
     */
    function getRegistrationTime(string calldata _customerId) external view returns (uint256) {
        bytes32 customerIdHash = keccak256(abi.encodePacked(_customerId));
        require(pinRegistry[customerIdHash].exists, "PIN not registered");
        return pinRegistry[customerIdHash].registeredAt;
    }
    
    /**
     * @notice Get total number of registered customers
     * @return The count
     */
    function getRegisteredCount() external view returns (uint256) {
        return registeredCustomers.length;
    }
    
    /**
     * @notice Get a registered customer by index
     * @param _index The index
     * @return The customer ID hash
     */
    function getRegisteredCustomer(uint256 _index) external view returns (bytes32) {
        require(_index < registeredCustomers.length, "Index out of bounds");
        return registeredCustomers[_index];
    }
}
