import { MdsSdk } from '@maddonkeysoftware/mds-cloud-sdk-node';
import { StateMachineServiceClient } from '@maddonkeysoftware/mds-cloud-sdk-node/clients';
import { invokeStateMachineWithMessage } from '../invoke-state-machine-with-message';

jest.mock('@maddonkeysoftware/mds-cloud-sdk-node', () => ({
  MdsSdk: {
    getStateMachineServiceClient: jest.fn(),
  },
}));
const mockedMdsSdk = jest.mocked(MdsSdk);

describe('invokeStateMachineWithMessage', () => {
  it('gets mdssdk client and invokes function', async () => {
    // Arrange
    const testResource = 'testResource';
    const fakeClient = {
      invokeStateMachine: jest.fn().mockResolvedValue(undefined),
    };
    const fakeMessage = 'fakeMessage';
    mockedMdsSdk.getStateMachineServiceClient.mockResolvedValueOnce(
      fakeClient as unknown as StateMachineServiceClient,
    );

    // Act
    await invokeStateMachineWithMessage({
      resource: testResource,
      message: fakeMessage,
    });

    // Assert
    expect(fakeClient.invokeStateMachine).toHaveBeenCalledTimes(1);
    expect(fakeClient.invokeStateMachine).toHaveBeenCalledWith(
      testResource,
      fakeMessage,
    );
  });
});
