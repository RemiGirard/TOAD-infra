# install

## requirements

download the openstack rc file from the openstack dashboard and save it in credentials/PCP-XXXX-openrc.sh

```bash

## Install OpenStack

```bash
#!/bin/bash
# Update and upgrade system
sudo apt update && sudo apt upgrade -y

# Install necessary Python packages
sudo apt install -y python3-dev python3-venv

# Set up virtual environment
rm -rf openstack_cli # delete and recreate if exists
python3 -m venv openstack_cli

# Activate virtual environment and install requirements
source openstack_cli/bin/activate
pip install -r requirements.txt

# Source credentials
source credentials/PCP-XXXX-openrc.sh

```

Commands to run after each time you open a new terminal:

```bash
source openstack_cli/bin/activate
source credentials/PCP-XXXX-openrc.sh
```

## Usage

```bash
# list stacks
openstack stack list --print-empty
```
## Create a new stack

There can be some requirement depending on the stack you want to create.
Most of the time :
- a key pair
```bash
ssh-keygen
cat ~/.ssh/myKey.pub
openstack keypair create --public-key ~/.ssh/myKey.pub myKey
```
Copy your public key and go to horizon dashboard and create a key pair with the name inside the template.


```bash
openstack stack create --template ./heat/01-OneNode/mainVFloating.yaml --wait nameOfMyStack
openstack stack update --template ./heat/01-OneNode/mainVFloating.yaml --wait nameOfMyStack
```