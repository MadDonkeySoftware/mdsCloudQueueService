import { MdsSdk } from '@maddonkeysoftware/mds-cloud-sdk-node';

export async function invokeServerlessFunctionWithMessage({
  resource,
  message,
}: {
  resource: string;
  message: string;
}) {
  const client = await MdsSdk.getServerlessFunctionsClient();
  await client.invokeFunction(resource, message, true);
}
