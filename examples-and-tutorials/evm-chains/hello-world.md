---
description: Getting started with Telegraph is as simple as saying "Hello World"
---

# Hello World!

This tutorial will walk you through sending a message to an EVM chain from an EVM chain. **Step 1: Create a basic solidity contract** To start, let's create a basic solidity contract. This is the foundation of your bridge contract, and we will be building upon it in the next steps.

First, you'll need to define the version of the solidity compiler that you will be using. You can do this by including the `pragma` statement at the very top of your contract code, like this:

```
pragma solidity ^0.8.0;
```

Now, let's define our contract using the `contract` keyword, and call it `HelloWorld`.

```
contract HelloWorld {
    // ...
}
```

Now that we have the basic structure of our contract, we can add some state variables, functions, and events. For the sake of this example, let's add a string variable called `message`, that will be publicly accessible. We will also add a constructor function that sets the initial value of the message to "Hello, World!". Lastly, let's create two functions: `setMessage` that can change the value of the message, and `getMessage` that will allow us to read the message from the contract.

```
contract HelloWorld {
    string public message;

    constructor() public {
        message = "Hello, World!";
    }

    // Function to set a new message
    function setMessage(string calldata newMessage) external {
        message = newMessage;
        emit NewMessage(newMessage);
    }

    // Function to get the current message
    function getMessage() external view returns (string memory) {
        return message;
    }
}
```

That's it! You've successfully created your first solidity contract. This is the foundation of your bridge contract, and now you have a basic structure to build on. In the next steps, we'll be adding more functionality such as allowing the contract to communicate with other chains. So don't worry if it all seems simple for now.

**Step 2: Add an interface with the bridge contract's outboundMessage function**

Now that we have our basic contract set up, we need to add the ability for it to communicate with other chains. To do this, we will create an interface that defines the `outboundMessage` function that our contract will use to send messages to the bridge contract.

An interface is a way to define a contract's expected behavior, without specifying its implementation.

Here is an example of an interface for a bridge contract called `Bridge` that defines the `outboundMessage` function

```
// Define the Bridge interface
    interface Bridge {
        function outboundMessage(
            address from, 
            address to, 
            CrossChainData calldata data, 
            string calldata chain
        ) external payable;
    }
```

The `outboundMessage` function accepts several parameters:

* `from` is the address of the contract that is sending the message.
* `to` is the address of the contract that the message is intended for.
* `addresses`, `integers`, `strings`, `bools` are arrays that can be used to pass along data in the message.
* `chain` is a string parameter specifying which chain the message is going to.
* The `external payable` defines that this function can be called by external contracts and it allows also to make payments as msg.value.

You will then need to add a state variable to your `HelloWorld` contract that will reference the address of the deployed bridge contract, so that the contract knows where to send the messages.

```
contract HelloWorld {
    // ...
    Bridge public bridge;
    //...
}
```

In the constructor of the contract you can set the value of the `bridge` variable with the address of the deployed bridge contract. Now that we have the `Bridge` interface defined and the `bridge` state variable added to our `HelloWorld` contract, we need to initialize the `bridge` state variable in the constructor of the `HelloWorld` contract with the address of the deployed bridge contract.

Here's an example of how you can do this in the constructor function of the `HelloWorld` contract:

```
// Set the bridge address upon deployment
    constructor(address bridgeAddress) {
        message = "Hello, World!";
        bridge = Bridge(bridgeAddress);
    }
```

As you can see, we are passing in the address of the deployed bridge contract as an argument when the `HelloWorld` contract is deployed and we are assigning that value to the `bridge` state variable.

Keep in mind that you should always validate the \_bridgeAddress to be sure that it is the correct address.

It is important to make sure that the bridge contract is deployed and available on the network before you deploy the `HelloWorld` contract.

That's it for this step! Your `HelloWorld` contract is now able to communicate with the bridge contract using the `outboundMessage` function defined in the `Bridge` interface.

**Step 3: Call the outboundMessage function from the basic solidity contract**

Now that our `HelloWorld` contract is able to communicate with the bridge contract, we can call the `outboundMessage` function from the basic solidity contract to send messages.

You can do this by defining a new function in your `HelloWorld` contract, for example, `sendMessage`, which will be responsible for calling the `outboundMessage` function of the `bridge` contract.

Here's an example of how you can define the `sendMessage` function in the `HelloWorld` contract:

```
function sendMessage() public payable returns (bool) {
        require(msg.value > 0, "Fee amount must be greater than 0");
        address[] memory addresses = new address[](1);
        uint256[] memory integers = new uint256[](1);
        string[] memory strings = new string[](1);
        bool[] memory bools = new bool[](1);
        
        strings[0] = message;

        // Ensure lengths comply with bridge constraints
        require(addresses.length <= 5, "Addresses array length must be <= 5");
        require(integers.length <= 5, "Integers array length must be <= 5");
        require(strings.length <= 5, "Strings array length must be <= 5");
        require(bools.length <= 5, "Bools array length must be <= 5");

        // Prepare CrossChainData
        CrossChainData memory data = CrossChainData({
            addresses: addresses,
            integers: integers,
            strings: strings,
            bools: bools
        });

        // Call the bridge's outboundMessage
        bridge.outboundMessage{ value: msg.value }(
            address(this), 
            0x40A424C6e75eB7eCCE1A6Bc44F3b440d26FA7FD2, 
            data, 
            "ETH-Sepolia"
        );

        return true;
    }
```

The `sendMessage` function calls the `outboundMessage` function of the bridge contract and passes in several parameters:

* `address(this)` is the address of the contract that is sending the message
* `0x0000000000000000000000000000000000000000` is the address of the contract that the message is intended for (in this case, it's a placeholder)
* `addresses`, `integers`, `strings`, `bools` are arrays that can be used to pass along data in the message.
* `"ETH-Rinkeby"` is a string parameter specifying which chain the message is going to.

You can also pass more variables and customize the data that you're passing, depending on your use case.

Also please note that the contract should have enough balance to perform the transaction, otherwise the call will fail.

You've now implemented the ability to send messages to the bridge contract from your basic solidity contract. This will allow your contract to communicate with other chains. But it's not done yet, we need to listen to the incoming messages and handle them as desired. In the next step, you will add event listeners to the bridge contract to handle the incoming messages.

**Step 4: Listen for incoming messages**

In this step, we will add event listeners to the bridge contract to handle incoming messages.

The first thing you need to do is to define an event in the `HelloWorld` contract. This event will be triggered when a message is received by the contract.

Here's an example of how you can define the `NewMessage` event:

Copy

```
event NewMessage(string message);
```

Now, you need to add a function in the `HelloWorld` contract that will be responsible for handling the incoming messages. Here's an example of how you can define the `portMessage` function:

Copy

```
function portMessage(address[] memory addresses, uint256[] memory numbers, string[] memory strings, bool[] memory bools) public {
        require(addresses.length > 0, "Address array empty");
        require(strings.length > 0, "String array empty");

        // Set the message to the incoming one
        message = strings[0];
        emit NewMessage(strings[0]);
    }
```

The `portMessage` function accepts several parameters:

* `addresses` is an array that can be used to pass along the address data in the message.
* `numbers` is an array that can be used to pass along the numbers data in the message.
* `strings` is an array that can be used to pass along the strings data in the message.
* `bools` is an array that can be used to pass along the booleans data in the message.

This function includes a simple check to make sure that the `addresses` and `strings` arrays are not empty, and emits the `NewMessage` event passing the first string of the strings array as the parameter.

You can also add more validation and security to the function, for example, check whether the address data is coming from the correct source.

Finally, you can listen to this event in your `HelloWorld` contract and handle the received message however you want.

This function should be called by the bridge contract to pass the received message to the `HelloWorld` contract.

That's it! you have successfully set up a way for your contract to listen for and handle incoming messages across different chains. Please keep in mind that you need to adjust the logic in the `portMessage` function according to your needs.

Your final contract should look something like this:

```
pragma solidity ^0.8.0;

contract HelloWorld {
    string public message;
    event NewMessage(string message);

    // Bridge instance
    Bridge public bridge;

    // Set the bridge address upon deployment
    constructor(address bridgeAddress) {
        message = "Hello, World!";
        bridge = Bridge(bridgeAddress);
    }

    // Function to set a new message
    function setMessage(string calldata newMessage) external {
        message = newMessage;
        emit NewMessage(newMessage);
    }

    // Function to get the current message
    function getMessage() external view returns (string memory) {
        return message;
    }

    function portMessage(
        address[] memory addresses,
        uint256[] memory numbers,
        string[] memory strings,
        bool[] memory bools
    ) public {
        require(addresses.length > 0, "Address array empty");
        require(strings.length > 0, "String array empty");

        // Set the message to the incoming one
        message = strings[0];
        emit NewMessage(strings[0]);
    }

    function sendMessage() public payable returns (bool) {
        require(msg.value > 0, "Fee amount must be greater than 0");
        address[] memory addresses = new address[](1);
        uint256[] memory integers = new uint256[](1);
        string[] memory strings = new string[](1);
        bool[] memory bools = new bool[](1);

        strings[0] = message;

        // Ensure lengths comply with bridge constraints
        require(addresses.length <= 5, "Addresses array length must be <= 5");
        require(integers.length <= 5, "Integers array length must be <= 5");
        require(strings.length <= 5, "Strings array length must be <= 5");
        require(bools.length <= 5, "Bools array length must be <= 5");

        // Prepare CrossChainData
        CrossChainData memory data = CrossChainData({
            addresses: addresses,
            integers: integers,
            strings: strings,
            bools: bools
        });

        // Call the bridge's outboundMessage
        bridge.outboundMessage{value: msg.value}(
            address(this),
            0x40A424C6e75eB7eCCE1A6Bc44F3b440d26FA7FD2,
            data,
            "ETH-Sepolia"
        );

        return true;
    }
}

// CrossChainData struct as required by the bridge
    struct CrossChainData {
        address[] addresses;
        uint256[] integers;
        string[] strings;
        bool[] bools;
    }

    
// Define the Bridge interface
interface Bridge {
    function outboundMessage(
        address from,
        address to,
        CrossChainData calldata data,
        string calldata chain
    ) external payable;
}
```

[<br>](https://telegraph-1.gitbook.io/what-is-telegraph/examples-and-tutorials/evm-chains)
