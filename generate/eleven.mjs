import fetch from 'node-fetch';
import fs, { existsSync, readdirSync } from 'fs';
import dotenv from 'dotenv';
import transcriptFunction from './transcript.mjs';
import { writeFile } from 'fs/promises';
import { query } from './dbClient.mjs';
import Groq from 'groq-sdk/index.mjs';
import exec from 'await-exec'; // single-threaded voice generation
//import { exec } from 'child_process'; // multi-threaded voice generation


dotenv.config();

import OpenAI from 'openai';

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

const groq = new Groq({
	apiKey: process.env.GROQ_API_KEY,
});

export async function generateTranscriptAudio(
	local,
	topic,
	agentA,
	agentB,
	ai,
	fps,
	duration,
	background,
	music,
	videoId
) {
	if (!local) {
		await query(
			"UPDATE `pending-videos` SET status = 'Generating transcript', progress = 0 WHERE video_id = ?",
			[videoId]
		);
	}

	let transcript = (await transcriptFunction(topic, agentA, agentB, duration))
		.transcript;

	const audios = [];

	if (!local) {
		await query(
			"UPDATE `pending-videos` SET status = 'Fetching images', progress = 5 WHERE video_id = ?",
			[videoId]
		);
	}

	const images = await fetchValidImages(
		transcript,
		transcript.length,
		ai,
		duration
	);

	if (!local) {
		await query(
			"UPDATE `pending-videos` SET status = 'Generating audio', progress = 12 WHERE video_id = ?",
			[videoId]
		);
	}

	for (let i = 0; i < transcript.length; i++) {
		const person = transcript[i].person;
		const line = transcript[i].line;

		//await generateAudio(voice_id, person, line, i);
		await generateAudio(person, line, i);
		audios.push({
			person: person,
			audio: `public/voice/${person}-${i}.mp3`,
			index: i,
			image:
				ai && duration === 1
					? images[i].imageUrl
					: images[i]?.link || 'https://images.smart.wtf/black.png',
		});
		console.log(readdirSync('public/voice'))
	}
	/*const folder = [];
	for (let i = 0; i < transcript.length; i++) {
		const person = transcript[i].person;
		const line = transcript[i].line;
		await generateAudio(person, line, i);
		folder.push(person + "-" + i + ".mp3");
		audios.push({
			person: person,
			audio: `public/voice/${person}-${i}.mp3`,
			index: i,
			image:
				ai && duration === 1
					? images[i].imageUrl
					: images[i]?.link || 'https://images.smart.wtf/black.png',
		});
	}
	while (JSON.stringify(folder.sort()) != JSON.stringify(readdirSync('public/voice').sort())) {

	}
	console.log("done")*/

	//await generateAudio(voice_id, person, line, i);


	const initialAgentName = audios[0].person;


	// PAY ATTENTION TO THIS

	const videoIndex = Math.floor(Math.random() * fs.readdirSync('public/background').filter((element) => element.startsWith(background + '-')).length) + 1;

	const contextContent = `
import { staticFile } from 'remotion';

export const music: string = '/music/${music}.MP3';
export const fps = ${fps};
export const initialAgentName = '${initialAgentName}';
export const videoFileName = 'background/${background}-' + ${videoIndex} + '.mp4';
export const subtitlesFileName = [
  ${audios
			.map(
				(entry, i) => `{
    name: '${entry.person}',
    file: staticFile('srt/${entry.person}-${i}.srt'),
    asset: '${entry.image}',
  }`
			)
			.join(',\n  ')}
];
`;

	await writeFile('src/tmp/context.tsx', contextContent, 'utf-8');

	return { audios, transcript };
}

export async function generateAudio(person, line, index) {
	//await exec(`echo '${line}' | piper --model public/voices/${person}.onnx --output_file public/voice/${person}-${index}.mp3`);
	await exec(`echo "${line}" | piper --model voices/obama.onnx --output_file public/voice/${person}-${index}.mp3`);
}

/*export async function generateAudio(voice_id, person, line, index) {
	const response = await fetch(
		`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`,
		{
			method: 'POST',
			headers: {
				'xi-api-key': process.env.ELEVEN_API_KEY,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				model_id: 'eleven_multilingual_v2',
				text: line,
				voice_settings: {
					stability: 0.5,
					similarity_boost: 0.75,
				},
			}),
		}
	);

	if (!response.ok) {
		throw new Error(`Server responded with status code ${response.status}`);
	}

	const audioStream = fs.createWriteStream(
		`public/voice/${person}-${index}.mp3`
	);
	response.body.pipe(audioStream);

	return new Promise((resolve, reject) => {
		audioStream.on('finish', () => {
			resolve('Audio file saved as output.mp3');
		});
		audioStream.on('error', reject);
	});
}*/

async function fetchValidImages(transcript, length, ai, duration) {

	const images = [];
	images.push({ link: 'https://images.smart.wtf/black.png' });
	return images;

	if (ai && duration === 1) {
		const promises = [];

		for (let i = 0; i < length; i++) {
			promises.push(imageGeneneration(transcript[i].asset));
		}

		const aiImages = await Promise.all(promises);

		return aiImages;
	} else {
		const images = [];
		for (let i = 0; i < length; i++) {
			const imageFetch = await fetch(
				`https://www.googleapis.com/customsearch/v1?q=${encodeURI(
					transcript[i].asset
				)}&cx=${process.env.GOOGLE_CX}&searchType=image&key=${process.env.GOOGLE_API_KEY
				}&num=${4}`,
				{
					method: 'GET',
					headers: { 'Content-Type': 'application/json' },
				}
			);
			const imageResponse = await imageFetch.json();

			// Check if the response contains 'items' and they are iterable
			if (
				!Array.isArray(imageResponse.items) ||
				imageResponse.items.length === 0
			) {
				console.log(
					'No images found or items not iterable',
					imageResponse.items
				);
				images.push({ link: 'https://images.smart.wtf/black.png' });
				continue; // Skip to the next iteration
			}

			const validMimeTypes = ['image/png', 'image/jpeg'];
			let imageAdded = false;

			for (let image of imageResponse.items) {
				if (validMimeTypes.includes(image.mime)) {
					const isViewable = await checkImageHeaders(image.link);
					if (isViewable) {
						images.push(image);
						imageAdded = true;
						break; // Stop after adding one valid image
					}
				}
			}

			// If no valid images were added, push a default image
			if (!imageAdded) {
				images.push({ link: 'https://images.smart.wtf/black.png' });
			}
		}

		return images;
	}
}

async function checkImageHeaders(url) {
	try {
		const response = await fetch(url, { method: 'HEAD' });
		const contentType = response.headers.get('Content-Type');
		const contentDisposition = response.headers.get('Content-Disposition');

		// Check for direct image content types and absence of attachment disposition
		if (
			contentType.includes('image/png') ||
			contentType.includes('image/jpeg')
		) {
			if (!contentDisposition || !contentDisposition.includes('attachment')) {
				return true; // Image is likely viewable directly in the browser
			}
		}
	} catch (error) {
		console.error('Error checking image headers:', error);
	}
	return false;
}

const imagePrompt = async (title) => {
	try {
		/*const response = await openai.chat.completions.create({
			model: 'ft:gpt-3.5-turbo-1106:personal::8TEhcfKm',
			messages: [
				{
					role: 'user',
					content: title,
				},
			],
		});*/
		const completion = await groq.chat.completions.create({
			messages: [
				{
					role: 'system',
					content: title,
				}
			],
			model: 'llama3-8b-8192',
			temperature: 0.5,
			max_tokens: 4096,
			top_p: 1,
			stop: null,
			stream: false,
		});
		return completion.choices[0]?.message.content;

		//return response.choices[0]?.message.content;
	} catch (error) {
		console.error('Error fetching data:', error);
	}
};

const imageGeneneration = async (initialPrompt) => {
	const prompt = await imagePrompt(initialPrompt);
	const detailed8BitPreface =
		'Create an image in a detailed retro 8-bit style. The artwork should have a pixelated texture and should have vibrant coloring and scenery.';

	let fullPrompt = `${detailed8BitPreface} ${prompt} Remember, this is in retro 8-bit style`;
	fullPrompt = fullPrompt.substring(0, 900);

	const responseFetch = await openai.images.generate({
		model: 'dall-e-3',
		prompt: fullPrompt,
		n: 1,
		size: '1024x1024',
		quality: 'standard',
		style: 'vivid',
		response_format: 'url',
		user: 'user-1234',
	});

	return {
		imageUrl: responseFetch.data[0]?.url,
		initialPrompt: initialPrompt,
		prompt: prompt,
	};
};
