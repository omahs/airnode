const { expect } = require('chai');
const { createTemplate } = require('./helpers/template');
const { createProvider } = require('./helpers/provider');
const { createRequester } = require('./helpers/requester');
const { makeRequest, makeFullRequest } = require('./helpers/request');
const { deriveWalletAddressFromPath, deriveWalletFromPath, verifyLog } = require('./util');

let airnode;
let airnodeClient;
let requestTimeAirnodeClient;
let roles;

let providerMnemonic;
let providerXpub;
let providerId;
let endpointId;
let requesterIndex;
let designatedWalletAddress;
let designatedWallet;
let fulfillAddress;
let fulfillFunctionId;
let parameters;
let templateId;
let templateBytesId;

let requestTimeRequesterIndex;
let requestTimeDesignatedWalletAddress;
let requestTimeDesignatedWallet;
let requestTimeFulfillAddress;
let requestTimeParameters;

let statusCode;
let bytesData;

beforeEach(async () => {
  const accounts = await ethers.getSigners();
  roles = {
    deployer: accounts[0],
    providerAdmin: accounts[1],
    requesterAdmin: accounts[2],
    clientUser: accounts[3],
    randomPerson: accounts[9],
  };
  const airnodeFactory = await ethers.getContractFactory('Airnode', roles.deployer);
  airnode = await airnodeFactory.deploy();
  const airnodeClientFactory = await ethers.getContractFactory('MockAirnodeClient', roles.deployer);
  airnodeClient = await airnodeClientFactory.deploy(airnode.address);

  ({ providerMnemonic, providerXpub, providerId } = await createProvider(airnode, roles.providerAdmin));
  endpointId = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['string'], ['convertToUsd']));
  requesterIndex = await createRequester(airnode, roles.requesterAdmin);
  designatedWalletAddress = deriveWalletAddressFromPath(providerXpub, `m/0/${requesterIndex.toString()}`);
  designatedWallet = deriveWalletFromPath(providerMnemonic, `m/0/${requesterIndex.toString()}`);
  await roles.requesterAdmin.sendTransaction({
    to: designatedWallet.address,
    value: ethers.utils.parseEther('0.1'),
  });
  fulfillAddress = airnodeClient.address;
  fulfillFunctionId = ethers.utils.hexDataSlice(
    ethers.utils.keccak256(ethers.utils.toUtf8Bytes('fulfill(bytes32,uint256,bytes)')),
    0,
    4
  );
  parameters = ethers.utils.randomBytes(8);
  templateId = await createTemplate(
    airnode,
    providerId,
    endpointId,
    requesterIndex,
    designatedWalletAddress,
    fulfillAddress,
    fulfillFunctionId,
    parameters
  );
  templateBytesId = await createTemplate(
    airnode,
    providerId,
    endpointId,
    requesterIndex,
    designatedWalletAddress,
    fulfillAddress,
    fulfillFunctionId,
    parameters
  );

  requestTimeRequesterIndex = await createRequester(airnode, roles.requesterAdmin);
  requestTimeDesignatedWalletAddress = deriveWalletAddressFromPath(
    providerXpub,
    `m/0/${requestTimeRequesterIndex.toString()}`
  );
  requestTimeDesignatedWallet = deriveWalletFromPath(providerMnemonic, `m/0/${requestTimeRequesterIndex.toString()}`);
  await roles.requesterAdmin.sendTransaction({
    to: requestTimeDesignatedWallet.address,
    value: ethers.utils.parseEther('0.1'),
  });
  requestTimeAirnodeClient = await airnodeClientFactory.deploy(airnode.address);
  requestTimeFulfillAddress = requestTimeAirnodeClient.address;
  requestTimeParameters = ethers.utils.randomBytes(16);

  statusCode = ethers.BigNumber.from(5);
  bytesData = ethers.utils.randomBytes(32);
});

describe('makeRequest', function () {
  context('If the client is endorsed by the requester', async function () {
    it('makes a regular request', async function () {
      await makeRequest(
        airnode,
        requestTimeAirnodeClient,
        roles.requesterAdmin,
        roles.clientUser,
        templateId,
        providerId,
        requestTimeRequesterIndex,
        requestTimeDesignatedWalletAddress,
        requestTimeFulfillAddress,
        fulfillFunctionId,
        requestTimeParameters
      );
    });
  });
  context('If the client is not endorsed by the requester', async function () {
    it('reverts', async function () {
      await expect(
        airnodeClient
          .connect(roles.clientUser)
          .makeRequest(
            templateId,
            requesterIndex,
            designatedWalletAddress,
            fulfillAddress,
            fulfillFunctionId,
            parameters
          )
      ).to.be.revertedWith('Client not endorsed by requester');
    });
  });
});

describe('makeFullRequest', function () {
  context('If the client is endorsed by the requester', async function () {
    it('makes a full request', async function () {
      await makeFullRequest(
        airnode,
        airnodeClient,
        roles.requesterAdmin,
        roles.clientUser,
        providerId,
        endpointId,
        requesterIndex,
        designatedWalletAddress,
        fulfillAddress,
        fulfillFunctionId,
        requestTimeParameters
      );
    });
  });
  context('If the client is not endorsed by the requester', async function () {
    it('reverts', async function () {
      await expect(
        airnodeClient
          .connect(roles.clientUser)
          .makeFullRequest(
            providerId,
            endpointId,
            requesterIndex,
            designatedWalletAddress,
            fulfillAddress,
            fulfillFunctionId,
            parameters
          )
      ).to.be.revertedWith('Client not endorsed by requester');
    });
  });
});

describe('fulfill', function () {
  context('If regular request has been made', async function () {
    context('If fulfillment parameters are correct', async function () {
      it('fulfills', async function () {
        const requestId = await makeRequest(
          airnode,
          requestTimeAirnodeClient,
          roles.requesterAdmin,
          roles.clientUser,
          templateId,
          providerId,
          requestTimeRequesterIndex,
          requestTimeDesignatedWalletAddress,
          requestTimeFulfillAddress,
          fulfillFunctionId,
          requestTimeParameters
        );
        const tx = await airnode
          .connect(requestTimeDesignatedWallet)
          .fulfill(requestId, providerId, statusCode, bytesData, requestTimeFulfillAddress, fulfillFunctionId, {
            gasLimit: 500000,
          });
        await verifyLog(airnode, tx, 'ClientRequestFulfilled(bytes32,bytes32,uint256,bytes)', {
          providerId,
          requestId,
          statusCode,
          data: ethers.utils.hexlify(bytesData),
        });
        await verifyLog(requestTimeAirnodeClient, tx, 'RequestFulfilled(bytes32,uint256,bytes)', {
          requestId,
          statusCode,
          data: ethers.utils.hexlify(bytesData),
        });
      });
    });
    context('Request ID is incorrect', async function () {
      it('reverts', async function () {
        await makeRequest(
          airnode,
          requestTimeAirnodeClient,
          roles.requesterAdmin,
          roles.clientUser,
          templateId,
          providerId,
          requestTimeRequesterIndex,
          requestTimeDesignatedWalletAddress,
          requestTimeFulfillAddress,
          fulfillFunctionId,
          requestTimeParameters
        );
        const falseRequestId = '0x000000000000000000000000000000000000000000000000000000000000dead';
        await expect(
          airnode
            .connect(requestTimeDesignatedWallet)
            .fulfill(falseRequestId, providerId, statusCode, bytesData, requestTimeFulfillAddress, fulfillFunctionId, {
              gasLimit: 500000,
            })
        ).to.be.revertedWith('Incorrect fulfillment parameters');
      });
    });
    context('Provider ID is incorrect', async function () {
      it('reverts', async function () {
        const requestId = await makeRequest(
          airnode,
          requestTimeAirnodeClient,
          roles.requesterAdmin,
          roles.clientUser,
          templateId,
          providerId,
          requestTimeRequesterIndex,
          requestTimeDesignatedWalletAddress,
          requestTimeFulfillAddress,
          fulfillFunctionId,
          requestTimeParameters
        );
        const falseProviderId = '0x000000000000000000000000000000000000000000000000000000000000dead';
        await expect(
          airnode
            .connect(requestTimeDesignatedWallet)
            .fulfill(requestId, falseProviderId, statusCode, bytesData, requestTimeFulfillAddress, fulfillFunctionId, {
              gasLimit: 500000,
            })
        ).to.be.revertedWith('Incorrect fulfillment parameters');
      });
    });
    context('Fulfill address is incorrect', async function () {
      it('reverts', async function () {
        const requestId = await makeRequest(
          airnode,
          requestTimeAirnodeClient,
          roles.requesterAdmin,
          roles.clientUser,
          templateId,
          providerId,
          requestTimeRequesterIndex,
          requestTimeDesignatedWalletAddress,
          requestTimeFulfillAddress,
          fulfillFunctionId,
          requestTimeParameters
        );
        const falseFulfillAddress = '0x000000000000000000000000000000000000dead';
        await expect(
          airnode
            .connect(requestTimeDesignatedWallet)
            .fulfill(requestId, providerId, statusCode, bytesData, falseFulfillAddress, fulfillFunctionId, {
              gasLimit: 500000,
            })
        ).to.be.revertedWith('Incorrect fulfillment parameters');
      });
    });
    context('Fulfill function ID is incorrect', async function () {
      it('reverts', async function () {
        const requestId = await makeRequest(
          airnode,
          requestTimeAirnodeClient,
          roles.requesterAdmin,
          roles.clientUser,
          templateId,
          providerId,
          requestTimeRequesterIndex,
          requestTimeDesignatedWalletAddress,
          requestTimeFulfillAddress,
          fulfillFunctionId,
          requestTimeParameters
        );
        const falseFulfillFunctionId = '0x0000dead';
        await expect(
          airnode
            .connect(requestTimeDesignatedWallet)
            .fulfill(requestId, providerId, statusCode, bytesData, requestTimeFulfillAddress, falseFulfillFunctionId, {
              gasLimit: 500000,
            })
        ).to.be.revertedWith('Incorrect fulfillment parameters');
      });
    });
    context('Fulfilling wallet is incorrect', async function () {
      it('reverts', async function () {
        const requestId = await makeRequest(
          airnode,
          requestTimeAirnodeClient,
          roles.requesterAdmin,
          roles.clientUser,
          templateId,
          providerId,
          requestTimeRequesterIndex,
          requestTimeDesignatedWalletAddress,
          requestTimeFulfillAddress,
          fulfillFunctionId,
          requestTimeParameters
        );
        await expect(
          airnode
            .connect(roles.randomPerson)
            .fulfill(requestId, providerId, statusCode, bytesData, requestTimeFulfillAddress, fulfillFunctionId, {
              gasLimit: 500000,
            })
        ).to.be.revertedWith('Incorrect fulfillment parameters');
      });
    });
  });
  context('If full request has been made', async function () {
    context('If fulfillment parameters are correct', async function () {
      it('fulfills', async function () {
        const requestId = await makeFullRequest(
          airnode,
          airnodeClient,
          roles.requesterAdmin,
          roles.clientUser,
          providerId,
          endpointId,
          requesterIndex,
          designatedWalletAddress,
          fulfillAddress,
          fulfillFunctionId,
          requestTimeParameters
        );
        const tx = await airnode
          .connect(designatedWallet)
          .fulfill(requestId, providerId, statusCode, bytesData, fulfillAddress, fulfillFunctionId, {
            gasLimit: 500000,
          });
        await verifyLog(airnode, tx, 'ClientRequestFulfilled(bytes32,bytes32,uint256,bytes)', {
          providerId,
          requestId,
          statusCode,
          data: ethers.utils.hexlify(bytesData),
        });
        await verifyLog(airnodeClient, tx, 'RequestFulfilled(bytes32,uint256,bytes)', {
          requestId,
          statusCode,
          data: ethers.utils.hexlify(bytesData),
        });
      });
    });
    context('Request ID is incorrect', async function () {
      it('reverts', async function () {
        await makeFullRequest(
          airnode,
          airnodeClient,
          roles.requesterAdmin,
          roles.clientUser,
          providerId,
          endpointId,
          requesterIndex,
          designatedWalletAddress,
          fulfillAddress,
          fulfillFunctionId,
          requestTimeParameters
        );
        const falseRequestId = '0x000000000000000000000000000000000000000000000000000000000000dead';
        await expect(
          airnode
            .connect(designatedWallet)
            .fulfill(falseRequestId, providerId, statusCode, bytesData, fulfillAddress, fulfillFunctionId, {
              gasLimit: 500000,
            })
        ).to.be.revertedWith('Incorrect fulfillment parameters');
      });
    });
    context('Provider ID is incorrect', async function () {
      it('reverts', async function () {
        const requestId = await makeFullRequest(
          airnode,
          airnodeClient,
          roles.requesterAdmin,
          roles.clientUser,
          providerId,
          endpointId,
          requesterIndex,
          designatedWalletAddress,
          fulfillAddress,
          fulfillFunctionId,
          requestTimeParameters
        );
        const falseProviderId = '0x000000000000000000000000000000000000000000000000000000000000dead';
        await expect(
          airnode
            .connect(designatedWallet)
            .fulfill(requestId, falseProviderId, statusCode, bytesData, fulfillAddress, fulfillFunctionId, {
              gasLimit: 500000,
            })
        ).to.be.revertedWith('Incorrect fulfillment parameters');
      });
    });
    context('Fulfill address is incorrect', async function () {
      it('reverts', async function () {
        const requestId = await makeFullRequest(
          airnode,
          airnodeClient,
          roles.requesterAdmin,
          roles.clientUser,
          providerId,
          endpointId,
          requesterIndex,
          designatedWalletAddress,
          fulfillAddress,
          fulfillFunctionId,
          requestTimeParameters
        );
        const falseFulfillAddress = '0x000000000000000000000000000000000000dead';
        await expect(
          airnode
            .connect(designatedWallet)
            .fulfill(requestId, providerId, statusCode, bytesData, falseFulfillAddress, fulfillFunctionId, {
              gasLimit: 500000,
            })
        ).to.be.revertedWith('Incorrect fulfillment parameters');
      });
    });
    context('Fulfill function ID is incorrect', async function () {
      it('reverts', async function () {
        const requestId = await makeFullRequest(
          airnode,
          airnodeClient,
          roles.requesterAdmin,
          roles.clientUser,
          providerId,
          endpointId,
          requesterIndex,
          designatedWalletAddress,
          fulfillAddress,
          fulfillFunctionId,
          requestTimeParameters
        );
        const falseFulfillFunctionId = '0x0000dead';
        await expect(
          airnode
            .connect(designatedWallet)
            .fulfill(requestId, providerId, statusCode, bytesData, fulfillAddress, falseFulfillFunctionId, {
              gasLimit: 500000,
            })
        ).to.be.revertedWith('Incorrect fulfillment parameters');
      });
    });
    context('Fulfilling wallet is incorrect', async function () {
      it('reverts', async function () {
        const requestId = await makeFullRequest(
          airnode,
          airnodeClient,
          roles.requesterAdmin,
          roles.clientUser,
          providerId,
          endpointId,
          requesterIndex,
          designatedWalletAddress,
          fulfillAddress,
          fulfillFunctionId,
          requestTimeParameters
        );
        await expect(
          airnode
            .connect(roles.randomPerson)
            .fulfill(requestId, providerId, statusCode, bytesData, fulfillAddress, fulfillFunctionId, {
              gasLimit: 500000,
            })
        ).to.be.revertedWith('Incorrect fulfillment parameters');
      });
    });
  });
});

describe('fail', function () {
  context('If regular request has been made', async function () {
    context('If fulfillment parameters are correct', async function () {
      it('fails successfully', async function () {
        const requestId = await makeRequest(
          airnode,
          requestTimeAirnodeClient,
          roles.requesterAdmin,
          roles.clientUser,
          templateId,
          providerId,
          requestTimeRequesterIndex,
          requestTimeDesignatedWalletAddress,
          requestTimeFulfillAddress,
          fulfillFunctionId,
          requestTimeParameters
        );
        await expect(
          airnode
            .connect(requestTimeDesignatedWallet)
            .fail(requestId, providerId, requestTimeFulfillAddress, fulfillFunctionId, { gasLimit: 500000 })
        )
          .to.emit(airnode, 'ClientRequestFailed')
          .withArgs(providerId, requestId);
      });
    });
    context('Request ID is incorrect', async function () {
      it('reverts', async function () {
        await makeRequest(
          airnode,
          requestTimeAirnodeClient,
          roles.requesterAdmin,
          roles.clientUser,
          templateId,
          providerId,
          requestTimeRequesterIndex,
          requestTimeDesignatedWalletAddress,
          requestTimeFulfillAddress,
          fulfillFunctionId,
          requestTimeParameters
        );
        const falseRequestId = '0x000000000000000000000000000000000000000000000000000000000000dead';
        await expect(
          airnode
            .connect(requestTimeDesignatedWallet)
            .fail(falseRequestId, providerId, requestTimeFulfillAddress, fulfillFunctionId, { gasLimit: 500000 })
        ).to.be.revertedWith('Incorrect fulfillment parameters');
      });
    });
    context('Provider ID is incorrect', async function () {
      it('reverts', async function () {
        const requestId = await makeRequest(
          airnode,
          requestTimeAirnodeClient,
          roles.requesterAdmin,
          roles.clientUser,
          templateId,
          providerId,
          requestTimeRequesterIndex,
          requestTimeDesignatedWalletAddress,
          requestTimeFulfillAddress,
          fulfillFunctionId,
          requestTimeParameters
        );
        const falseProviderId = '0x000000000000000000000000000000000000000000000000000000000000dead';
        await expect(
          airnode
            .connect(requestTimeDesignatedWallet)
            .fail(requestId, falseProviderId, requestTimeFulfillAddress, fulfillFunctionId, { gasLimit: 500000 })
        ).to.be.revertedWith('Incorrect fulfillment parameters');
      });
    });
    context('Fulfill address is incorrect', async function () {
      it('reverts', async function () {
        const requestId = await makeRequest(
          airnode,
          requestTimeAirnodeClient,
          roles.requesterAdmin,
          roles.clientUser,
          templateId,
          providerId,
          requestTimeRequesterIndex,
          requestTimeDesignatedWalletAddress,
          requestTimeFulfillAddress,
          fulfillFunctionId,
          requestTimeParameters
        );
        const falseFulfillAddress = '0x000000000000000000000000000000000000dead';
        await expect(
          airnode
            .connect(requestTimeDesignatedWallet)
            .fail(requestId, providerId, falseFulfillAddress, fulfillFunctionId, { gasLimit: 500000 })
        ).to.be.revertedWith('Incorrect fulfillment parameters');
      });
    });
    context('Fulfill function ID is incorrect', async function () {
      it('reverts', async function () {
        const requestId = await makeRequest(
          airnode,
          requestTimeAirnodeClient,
          roles.requesterAdmin,
          roles.clientUser,
          templateId,
          providerId,
          requestTimeRequesterIndex,
          requestTimeDesignatedWalletAddress,
          requestTimeFulfillAddress,
          fulfillFunctionId,
          requestTimeParameters
        );
        const falseFulfillFunctionId = '0x0000dead';
        await expect(
          airnode
            .connect(requestTimeDesignatedWallet)
            .fail(requestId, providerId, requestTimeFulfillAddress, falseFulfillFunctionId, { gasLimit: 500000 })
        ).to.be.revertedWith('Incorrect fulfillment parameters');
      });
    });
    context('Fulfilling wallet is incorrect', async function () {
      it('reverts', async function () {
        const requestId = await makeRequest(
          airnode,
          requestTimeAirnodeClient,
          roles.requesterAdmin,
          roles.clientUser,
          templateId,
          providerId,
          requestTimeRequesterIndex,
          requestTimeDesignatedWalletAddress,
          requestTimeFulfillAddress,
          fulfillFunctionId,
          requestTimeParameters
        );
        await expect(
          airnode
            .connect(roles.randomPerson)
            .fail(requestId, providerId, requestTimeFulfillAddress, fulfillFunctionId, { gasLimit: 500000 })
        ).to.be.revertedWith('Incorrect fulfillment parameters');
      });
    });
  });
  context('If full request has been made', async function () {
    context('If fulfillment parameters are correct', async function () {
      it('fails successfully', async function () {
        const requestId = await makeFullRequest(
          airnode,
          airnodeClient,
          roles.requesterAdmin,
          roles.clientUser,
          providerId,
          endpointId,
          requesterIndex,
          designatedWalletAddress,
          fulfillAddress,
          fulfillFunctionId,
          requestTimeParameters
        );
        await expect(
          airnode
            .connect(designatedWallet)
            .fail(requestId, providerId, fulfillAddress, fulfillFunctionId, { gasLimit: 500000 })
        )
          .to.emit(airnode, 'ClientRequestFailed')
          .withArgs(providerId, requestId);
      });
    });
    context('Request ID is incorrect', async function () {
      it('reverts', async function () {
        await makeFullRequest(
          airnode,
          airnodeClient,
          roles.requesterAdmin,
          roles.clientUser,
          providerId,
          endpointId,
          requesterIndex,
          designatedWalletAddress,
          fulfillAddress,
          fulfillFunctionId,
          requestTimeParameters
        );
        const falseRequestId = '0x000000000000000000000000000000000000000000000000000000000000dead';
        await expect(
          airnode
            .connect(designatedWallet)
            .fail(falseRequestId, providerId, fulfillAddress, fulfillFunctionId, { gasLimit: 500000 })
        ).to.be.revertedWith('Incorrect fulfillment parameters');
      });
    });
    context('Provider ID is incorrect', async function () {
      it('reverts', async function () {
        const requestId = await makeFullRequest(
          airnode,
          airnodeClient,
          roles.requesterAdmin,
          roles.clientUser,
          providerId,
          endpointId,
          requesterIndex,
          designatedWalletAddress,
          fulfillAddress,
          fulfillFunctionId,
          requestTimeParameters
        );
        const falseProviderId = '0x000000000000000000000000000000000000000000000000000000000000dead';
        await expect(
          airnode
            .connect(designatedWallet)
            .fail(requestId, falseProviderId, fulfillAddress, fulfillFunctionId, { gasLimit: 500000 })
        ).to.be.revertedWith('Incorrect fulfillment parameters');
      });
    });
    context('Fulfill address is incorrect', async function () {
      it('reverts', async function () {
        const requestId = await makeFullRequest(
          airnode,
          airnodeClient,
          roles.requesterAdmin,
          roles.clientUser,
          providerId,
          endpointId,
          requesterIndex,
          designatedWalletAddress,
          fulfillAddress,
          fulfillFunctionId,
          requestTimeParameters
        );
        const falseFulfillAddress = '0x000000000000000000000000000000000000dead';
        await expect(
          airnode
            .connect(designatedWallet)
            .fail(requestId, providerId, falseFulfillAddress, fulfillFunctionId, { gasLimit: 500000 })
        ).to.be.revertedWith('Incorrect fulfillment parameters');
      });
    });
    context('Fulfill function ID is incorrect', async function () {
      it('reverts', async function () {
        const requestId = await makeFullRequest(
          airnode,
          airnodeClient,
          roles.requesterAdmin,
          roles.clientUser,
          providerId,
          endpointId,
          requesterIndex,
          designatedWalletAddress,
          fulfillAddress,
          fulfillFunctionId,
          requestTimeParameters
        );
        const falseFulfillFunctionId = '0x0000dead';
        await expect(
          airnode
            .connect(designatedWallet)
            .fail(requestId, providerId, fulfillAddress, falseFulfillFunctionId, { gasLimit: 500000 })
        ).to.be.revertedWith('Incorrect fulfillment parameters');
      });
    });
    context('Fulfilling wallet is incorrect', async function () {
      it('reverts', async function () {
        const requestId = await makeFullRequest(
          airnode,
          airnodeClient,
          roles.requesterAdmin,
          roles.clientUser,
          providerId,
          endpointId,
          requesterIndex,
          designatedWalletAddress,
          fulfillAddress,
          fulfillFunctionId,
          requestTimeParameters
        );
        await expect(
          airnode
            .connect(roles.randomPerson)
            .fail(requestId, providerId, fulfillAddress, fulfillFunctionId, { gasLimit: 500000 })
        ).to.be.revertedWith('Incorrect fulfillment parameters');
      });
    });
  });
});
