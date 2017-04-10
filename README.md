# IPFS Pub

A service for publishing files to [IPFS](https://ipfs.io/).


## Install

Install the [IPFS](https://ipfs.io/docs/install/) command-line daemon:

```sh
# Grab the latest version from here: https://dist.ipfs.io/#go-ipfs
curl -O https://dist.ipfs.io/go-ipfs/v0.4.8/go-ipfs_v0.4.8_linux-amd64.tar.gz

# Unpack the tarball.
tar xvfz go-ipfs.tar.gz

# Open the extracted directory.
cd go-ipfs

# Run the install script (which simply moves the `ipfs` binary to the `/usr/local/bin` directory).
./install.sh

```

Install the [Node](https://nodejs.org/download/) dependencies:

```sh
npm install
```


## Usage

# From one tab in the command line, start the IPFS daemon:

```sh
ipfs daemon
```

From another tab in the command line, start the local Node development server:

```sh
npm start
```


## License

[CC0 1.0 Universal (CC0 1.0) — Public Domain Dedication](LICENSE.md)
