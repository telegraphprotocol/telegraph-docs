# Networks

Each Network document stores information on each blockchain that the validator will begin to listen to upon startup. A key requirement for each network are provider URLs for both HTTPS and WSS endpoints. These urls will be unique for each validator and not be shared with other validators. The quality of a validator's chosen provider for a blockchain will determine their general response time for transaction detections.

Nodes within the network will be encouraged to use a wide variety of providers to ensure consistent uptime in a scenario where one or more prominent blockchain providers may experience service issues.

Below are the fields that make up a Network:
