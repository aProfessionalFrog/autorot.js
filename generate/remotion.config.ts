/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from '@remotion/cli/config';
import { enableTailwind } from '@remotion/tailwind';
import os from 'os';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setConcurrency(os.availableParallelism());
Config.setAudioBitrate("128k");
Config.setVideoBitrate("4000k");
Config.setAudioCodec("aac");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
//Config.setChromiumMultiProcessOnLinux(true);

// This template processes the whole audio file on each thread which is heavy.
Config.overrideWebpackConfig((currentConfiguration) => {
	return enableTailwind(currentConfiguration);
});
