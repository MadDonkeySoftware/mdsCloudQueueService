import { MdsSdk } from '@maddonkeysoftware/mds-cloud-sdk-node';
import { ServerlessFunctionsClient } from '@maddonkeysoftware/mds-cloud-sdk-node/clients';
import { invokeServerlessFunctionWithMessage } from '../invoke-serverless-function-with-message';

jest.mock('@maddonkeysoftware/mds-cloud-sdk-node', () => ({
  MdsSdk: {
    getServerlessFunctionsClient: jest.fn(),
  },
}));
const mockedMdsSdk = jest.mocked(MdsSdk);

describe('invokeServerlessFunctionWithMessage', () => {
  it('gets mdssdk client and invokes function', async () => {
    // Arrange
    const testResource = 'testResource';
    const fakeClient = {
      invokeFunction: jest.fn().mockResolvedValue(undefined),
    };
    const fakeMessage = 'fakeMessage';
    mockedMdsSdk.getServerlessFunctionsClient.mockResolvedValueOnce(
      fakeClient as unknown as ServerlessFunctionsClient,
    );

    // Act
    await invokeServerlessFunctionWithMessage({
      resource: testResource,
      message: fakeMessage,
    });

    // Assert
    expect(fakeClient.invokeFunction).toHaveBeenCalledTimes(1);
    expect(fakeClient.invokeFunction).toHaveBeenCalledWith(
      testResource,
      fakeMessage,
      true,
    );
  });
});
