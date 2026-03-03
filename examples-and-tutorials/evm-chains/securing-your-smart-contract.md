---
description: Shield up with modifiers
---

# Securing Your Smart Contract

Hello fellow Ethereum enthusiasts! In this article, we'll walk you through how to secure your smart contract which uses the Telegraph bridge for crosschain transactions. Specifically, we're going to add a modifier called `onlyBridge` to restrict who can call the `portMessage` function. This will ensure that only the bridge contract can call this function, thereby enhancing the security of our smart contract.

Moreover, we will also incorporate an authorization mechanism for senders using a mapping. This mechanism will further filter transactions and only allow those coming from authorized senders. Ready? Let's dive right in!

#### What's in a Modifier? <a href="#whats-in-a-modifier" id="whats-in-a-modifier"></a>

In Solidity, a modifier is a special type of function that can be used to change the behavior of other functions, in a declarative way. We can use it to check certain conditions before executing a function, for instance.

#### Adding the onlyBridge Modifier <a href="#adding-the-onlybridge-modifier" id="adding-the-onlybridge-modifier"></a>

To start, let's define our modifier. We're going to name it `onlyBridge`, and its purpose will be to ensure that the function it is applied to can only be called by the bridge contract. Here's how you'd define it:

```
address public bridgeAddress;
    
modifier onlyBridge() {
    require(msg.sender == bridgeAddress, "Caller is not the bridge");
    _;
}
```

In this snippet, `bridgeAddress` is the Ethereum address of the bridge contract. We'll need to set this in the constructor or with a separate setter function. The `require` function inside the modifier ensures that the sender of the message (`msg.sender`) is equal to the bridgeAddress. If it's not, the function will revert and an error message will be emitted. The underscore (`_`) at the end of the modifier tells Solidity where the rest of the function's code will go.

We can now use the `onlyBridge` modifier in our `portMessage` function like so:

```
function portMessage(
    address[] memory addresses, 
    uint256[] memory numbers, 
    string[] memory strings, 
    bool[] memory bools, 
    string sender) public onlyBridge {
    // function code here...
}
```

By adding `onlyBridge` after the `public` keyword, we're telling Solidity that this function should be modified by our `onlyBridge` modifier.

#### Implementing Sender Authorization <a href="#implementing-sender-authorization" id="implementing-sender-authorization"></a>

Now let's add an authorization mechanism to ensure that only transactions from authorized senders are processed. We'll create a mapping called `authorizedSenders` where the keys are the sender addresses (as strings) and the values are booleans indicating whether the sender is authorized.

Here's what the mapping might look like:

```
mapping(string => bool) public authorizedSenders;
```

To authorize a sender, we'd just need to set their corresponding value in the `authorizedSenders` mapping to `true`. We can create a function `authorizeSender` to handle this:

```
function authorizeSender(string memory sender) public {
    // Here you should add some code to restrict who can authorize new senders. 
    // For instance, you could require that msg.sender is a specific address.
    authorizedSenders[sender] = true;
}
```

Now we can update our `portMessage` function to only process the transaction if the sender is authorized:

```
function portMessage(address[] memory addresses, uint256[] memory numbers, string[] memory strings, bool[] memory bools, string sender) public onlyBridge {
    require(authorizedSenders[sender], "Sender is not authorized");
    // function code here...
}
```

This `require` statement checks that the `sender` is authorized before executing the rest of the function. If the sender is not authorized, the function will revert and an error message will be emitted.

By incorporating these security measures, your contract becomes more robust and resistant to unauthorized manipulations. But we don't just have to imagine what this final, more secure contract will look like, because here it is in all its glory:

```
pragma solidity ^0.8.0;

contract HelloWorld {
    string public message;
    event NewMessage(string message);
    address public bridgeAddress;
    mapping(string => bool) public authorizedSenders;

    constructor(address _bridgeAddress) public {
        message = "Hello, World!";
        bridgeAddress = _bridgeAddress;
    }
    
    modifier onlyBridge() {
        require(msg.sender == bridgeAddress, "Caller is not the bridge");
        _;
    }
    
    function authorizeSender(string memory sender) public {
        // Here you should add some code to restrict who can authorize new senders. 
        // For instance, you could require that msg.sender is a specific address.
        authorizedSenders[sender] = true;
    }

    function portMessage(address[] memory addresses, uint256[] memory numbers, string[] memory strings, bool[] memory bools, string sender) public onlyBridge {
        require(authorizedSenders[sender], "Sender is not authorized");
        require(addresses.length > 0, "Address array empty");
        require(strings.length > 0, "String array empty");
        emit NewMessage(strings[0]);
    }
    
    function sendMessage() public returns (bool) {
        address[] memory addresses = new address[](1);
        uint256[] memory integers = new uint256[](1);
        string[] memory strings = new string[](1);
        bool[] memory bools = new bool[](1);

        strings[0] = "Hello World";
        // send the message to the bridge
        bridge.outboundMessage(
            address(this), 
            0x0000000000000000000000000000000000000000, 
            addresses, 
            integers, 
            strings, 
            bools, 
            "ETH-Rinkeby");
        return true;
    }
}
```

This contract now has a specific `onlyBridge` modifier for `portMessage`, and a mapping system that allows transactions only from authorized senders. This makes it much more secure and resilient.

These safety measures ensure that your contract behaves as expected and that your users' assets are secure. Now, you can write your contract with confidence, knowing that it's both robust and secure. Keep coding, and keep exploring the fascinating world of blockchain development!
