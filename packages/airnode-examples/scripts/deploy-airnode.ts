import { join } from 'path';
import { getDockerImage } from '@api3/airnode-utilities';
import { cliPrint, isWindows, readIntegrationInfo, runAndHandleErrors, runShellCommand } from '../src';

const main = async () => {
  const integrationInfo = readIntegrationInfo();
  if (integrationInfo.airnodeType === 'local') {
    cliPrint.error('You only need to run this script if you deploy on a cloud provider');
    return;
  }

  const integrationPath = join(__dirname, '../integrations', integrationInfo.integration);
  const secretsFilePath = join(__dirname, '../aws.env');
  const deployCommand = [
    `docker run -it --rm`,
    isWindows() ? '' : `-e USER_ID=$(id -u) -e GROUP_ID=$(id -g)`,
    integrationInfo.airnodeType === 'aws' && `--env-file ${secretsFilePath}`,
    integrationInfo.airnodeType === 'gcp' && `-v "${integrationPath}/gcp.json:/app/gcp.json"`,
    `-v ${integrationPath}:/app/config`,
    `-v ${integrationPath}:/app/output`,
    `${getDockerImage('deployer')} deploy`,
  ]
    .filter(Boolean)
    .join(' ');

  runShellCommand(deployCommand);
};

runAndHandleErrors(main);
