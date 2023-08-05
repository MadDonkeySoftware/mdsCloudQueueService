import { MdsSdk } from '@maddonkeysoftware/mds-cloud-sdk-node';

export async function invokeStateMachineWithMessage({
  resource,
  message,
}: {
  resource: string;
  message: string;
}) {
  const client = await MdsSdk.getStateMachineServiceClient();
  await client.invokeStateMachine(resource, message);
}
