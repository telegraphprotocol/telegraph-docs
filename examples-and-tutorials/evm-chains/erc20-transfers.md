---
description: Fungibility Everywhere!
---

# ERC20 Transfers

**Step 1: Create a basic ERC20 contract using the OpenZeppelin library**

The first step in creating a cross-chain ERC20 contract is to create a basic ERC20 contract using the OpenZeppelin library. This library provides a set of reusable smart contracts for the Ethereum blockchain that are secure and tested.

To create a new ERC20 contract, you will first need to install the OpenZeppelin library by adding it as a dependency in your project. You can do this using a package manager like npm by running the following command:

```
npm install @openzeppelin/contracts
```

Once the library is installed, you can import the `ERC20` contract from the OpenZeppelin library and use it as the base for your new contract. Here is an example of how you can create a new `MyToken` contract that inherits from the `ERC20` contract:

```
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MyToken is ERC20 {
    constructor() ERC20("My Token", "MT") public {
        // The contract constructor is called when the contract is deployed
        // You can use this function to initialize the contract's state
    }
}
```

In this example, the `MyToken` contract inherits from the `ERC20` contract provided by the OpenZeppelin library. The `constructor` function is used to initialize the contract with the name "My Token" and symbol "MT".

And this is the basic ERC20 contract ready to use

In the next step, I'll guide you on how to add cross-chain transfer functionalities.

**Step 2: Add the cross-chain transfer functionality**

Now that you have a basic ERC20 contract, you can add the necessary functions to perform cross-chain transfers.

The first thing you need to do is to set the `bridgeAddress` variable to the address of the deployed bridge contract and define an interface with the `outboundMessage` function of the bridge contract.

```
address public bridgeAddress;
interface Bridge {
    function outboundMessage(
        address _sender, 
        address _destination,
        address[] memory _addressData, 
        uint256[] memory _numberData, 
        string[] memory _stringData, 
        bool[] memory _boolData, 
        string memory _endChain) external payable;
}
```

The next step is to add the `bridgeTransfer` function that will be used to transfer tokens to a recipient address on another chain. This function will be payable and should call the `outboundMessage` function in the bridge contract

```
    function bridgeTransfer(address recipient, uint256 amount, string memory endChain) public payable {
        //burn the tokens
        balanceOf[msg.sender] = balanceOf[msg.sender].sub(amount);
        //prepare the arrays to send the message
        address[] memory addresses =  new address[](1);
        addresses[0] = recipient;
        uint256[] memory numbers = new uint256[](1);
        numbers[0] = amount;
        string[] memory strings = new string[](1);
        bool[] memory bools = new bool[](1);
        
        //call the outboundMessage function in the bridge contract
        BridgeContract(bridgeAddress).outboundMessage.value(msg.value)(
            address(this),
            addresses, 
            numbers, 
            strings, 
            bools,
            endChain
        );
        emit Transfer(msg.sender, recipient, amount);
    }
```

The `bridgeTransfer` function has three parameters:

* `recepient` is the address of the recipient
* `amount` is the amount of tokens to be transferred
* `endChain` is the string that represent the end chain which the tokens should be transferred

It starts by checking that the msg.value passed is the same as the value of tokens to be transferred and that the contract has enough tokens to be able to transfer. Then it calls the outbound message function of the bridge contract passing the recipient address and the value of the tokens being transferred and the endChain. It burns the transferred tokens and emits a transfer event.

It is important to note that the `_burn` function should be implemented in your contract to properly reduce the total supply of tokens and update the balance of the sender.

You'll also need to make sure that this function is protected and can only be called by the owner or an authorized address, in order to prevent malicious actors from making unauthorized transfers.

You can now test your contract by calling the `bridgeTransfer` function and passing the correct parameters to transfer tokens to another chain. You should see the balance of the sender decrease and the `Transfer` event being emitted after the successful transfer.

**Step 3: Listen for incoming cross-chain messages**

In order to handle incoming cross-chain transfers, you need to add a function that will listen for incoming messages from the bridge contract. This function is called `portMessage`

The `portMessage` function will be called by the bridge contract and should handle the transfer of tokens from another chain to this contract by minting the recieved tokens.

Here's an example of how the `portMessage` function can be implemented:

```
modifier onlyBridge() {
    require(msg.sender == bridgeAddress, "Only the bridge contract can call this function.");
    _;
}

function portMessage(address[] memory _addressData, uint256[] memory _numberData, string[] memory _stringData, bool[] memory _boolData) public onlyBridge {
    //Check if the address array is not empty, just to be sure 
    require(_addressData.length > 0, "Address array is empty, we got no one to mint to.");
    //Check if the number array is not empty
    require(_numberData.length > 0, "Number array is empty, we got nothing to mint.");

    address _sender = _addressData[0];
    uint256 _amount = _numberData[0];
    //Mint the token
    _mint(_sender, _amount);
    //emit an event to notify the transfer
    emit Transfer(_sender, address(this), _amount);
    //just for fun, let's emit a event 
    emit("Minting party!!!", _sender, _amount);
}
```

As you can see, I added a `onlyBridge` modifier to the `portMessage` function. This modifier will check that the contract calling the function is the same as the `bridgeAddress` that you've set. The function then continues as before. It check that the arrays are not empty and it mints the tokens by calling the `_mint` internal function. Finally it emits a `Transfer` event to notify any other contract of the transfer and a fun event to let everyone know that the minting has happened.

It is important to note that the `bridgeAddress` variable should be set in the constructor or in a separated function that can only be called by the owner.

Adding this security measure ensures that only verified and expected cross-chain messages are processed, so you don't have to worry about some shady characters trying to sneak in unwanted token transfers. So far, your ERC20 token contract should have the following features:

* Implemented the OpenZeppelin ERC20 library
* A `bridgeTransfer` function which is payable, takes in 3 parameters (`recipient` address, `amount` uint, `endChain` string), it calls the outBound message function in the bridge contract.
* A `bridgeAddress` variable that is set by the contract's owner
* A `portMessage` function that has the correct parameter (`_addressData` address\[], `_numberData` uint256\[], `_stringData` string\[], `_boolData` bool\[]), this function should be protected by a onlyBridge modifier which only allows the bridge contract to call it. This function mints the token being transferred, emits a Transfer event and a custom event.
* a `_mint` internal function that should be implemented by the developer
* A constructor that sets the bridgeAddress

Here's what the full contract could look like:

```
pragma solidity ^0.8.3;
import "https://github.com/OpenZeppelin/openzeppelin-contracts/contracts/token/ERC20/SafeERC20.sol";

contract MyToken is ERC20, SafeERC20 {
    address public bridgeAddress;
    //function that only allows the bridge contract to call it
    modifier onlyBridge() {
        require(msg.sender == bridgeAddress, "Only the bridge contract can call this function.");
        _;
    }
    event MintingParty(string message, address sender, uint256 amount);
    
    constructor(address _bridge) public {
        bridgeAddress = _bridge;
    }
    
    //function to send tokens to other chain
    function bridgeTransfer(address recipient, uint256 amount, string memory endChain) public payable {
        require(amount <= balanceOf[msg.sender], "Insufficient funds.");
        //burn the tokens
        balanceOf[msg.sender] = balanceOf[msg.sender].sub(amount);
        //prepare the arrays to send the message
        address[] memory addresses =  new address[](1);
        addresses[0] = recipient;
        uint256[] memory numbers = new uint256[](1);
        numbers[0] = amount;
        string[] memory strings = new string[](1);
        bool[] memory bools = new bool[](1);
        //call the outboundMessage function in the bridge contract
        BridgeContract(bridgeAddress).outboundMessage.value(msg.value)(
            address(this),
            addresses, 
            numbers, 
            strings, 
            bools,
            endChain
        );
        emit Transfer(msg.sender, recipient, amount);
    }
    
    function portMessage(address[] memory _addressData, uint256[] memory _numberData, string[] memory _stringData, bool[] memory _boolData) public onlyBridge {
        //Check if the address array is not empty, just to be sure 
        require(_addressData.length > 0, "Address array is empty, we got no one to mint to.");
        //Check if the number array is not empty
        require(_numberData.length > 0, "Number array is empty, we got nothing to mint.");

        address _sender = _addressData[0];
        uint256 _amount = _numberData[0];
        //Mint the token
        _mint(_sender, _amount);
        //emit an event to notify the transfer
        emit Transfer(_sender, address(this), _amount);
        //just for fun, let's emit a custom event 
        emit MintingParty("Minting party!!!", _sender, _amount);
    }
    
}
```
