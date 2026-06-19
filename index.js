// Global Var
let currentResource = null; 
let globalVolume = 0.5; // Default Vol of 50%

// Bot Init

const { Client, GatewayIntentBits } = require('discord.js');
const { 
    joinVoiceChannel, 
    createAudioPlayer, 
    createAudioResource, 
    AudioPlayerStatus, 
    VoiceConnectionStatus 
} = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

const PREFIX = '?';
const MUSIC_DIR = path.join(__dirname, 'Music Files');

let playlist = [];
let player = null;
let connection = null;
let currentTextChannel = null;

// Make sure the music is actually there

if (!fs.existsSync(MUSIC_DIR)) {
    fs.mkdirSync(MUSIC_DIR);
}

// Read dir and shuff-le files
function loadShuffledPlaylist() {
    const files = fs.readdirSync(MUSIC_DIR)
        .filter(file => file.endsWith('.mp3'))
        .map(file => path.join(MUSIC_DIR, file));

    // Shuffle Algo (Fischer-Yates)
    for (let i = files.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [files[i], files[j]] = [files[j], files[i]];
    }
    return files;
}

// Play next song, if no more then message that out of songs

function playNext() {
    if (playlist.length === 0) {
        if (currentTextChannel) currentTextChannel.send("You have reached the end... for now");
        return;
    }

    const nextSongPath = playlist.shift();
    const songName = path.basename(nextSongPath);

    if (currentTextChannel) {
        currentTextChannel.send('Now playing: **${songName}**`');
    }

    // Inline vol enable
    currentResource = createAudioResource(nextSongPath, { inlineVolume: true });
    
    // Global vol application
    currentResource.volume.setVolume(globalVolume);

    player.play(currentResource);
}

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async (message) => {
    // Ignore all non prefixed messages
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'play') {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.reply("You need to be in VC to use this command!");
        }

        currentTextChannel = message.channel;
        playlist = loadShuffledPlaylist();

        if (playlist.length === 0) {
            return message.reply("The folder containing music is empty! Put some files there first.");
        }

        // vc connect
        connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator,
        });

        // Create audio player if not already
        if (!player) {
            player = createAudioPlayer();

            // Autoplay next song
            player.on(AudioPlayerStatus.Idle, () => {
                playNext();
            });
            // Error
            player.on('error', error => {
                console.error(`Error: ${error.message}`);
                playNext();
            });
        }

        connection.subscribe(player);
        message.channel.send(`Loaded and shuffled **${playlist.length}** songs. Playback Starting...`);
        playNext();
    }

    if (command === 'skip') {
        if (player && player.state.status !== AudioPlayerStatus.Idle) {
            message.channel.send("Skipped current track.");
            player.stop(); // Idle State
        } else {
            message.reply("Nothing is playing right now.");
        }
    }

    if (command === 'stop') {
        playlist = [];
        if (player) player.stop();
        if (connection) {
            connection.destroy();
            connection = null;
            message.channel.send("Stopped playback and left the voice channel.");
        } else {
            message.reply("I'm not connected to a voice channel.");
        }
    }

   // !vol
    if (command === 'volume' || command === 'vol') {
        const volArg = args[0];

        // Print current volume when no amount given
        if (!volArg) {
            return message.reply('Current volume is **${Math.round(globalVolume * 100)}%**`');
        }

        const volumePercent = parseInt(volArg, 10);

        // Validating input
        if (isNaN(volumePercent) || volumePercent < 0 || volumePercent > 100) {
            return message.reply("Not a valid volume level");
        }

        // int to float scale
        globalVolume = volumePercent / 100;

        // Fade volume if active media
        if (currentResource && currentResource.volume) {
            currentResource.volume.setVolume(globalVolume);
        }

        return message.channel.send(`Volume set to **${volumePercent}%**`);
    }
});

// Enable "Message Content Intent" in Dev Portal for token to work
client.login('INSERTTOKENHERE');