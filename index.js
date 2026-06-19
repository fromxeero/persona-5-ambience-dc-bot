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

const PREFIX = '!';
const MUSIC_DIR = path.join(__dirname, 'music');

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
        if (currentTextChannel) currentTextChannel.send("🛑 Reached the end of the shuffled playlist!");
        return;
    }

    const nextSongPath = playlist.shift();
    const songName = path.basename(nextSongPath);

    if (currentTextChannel) {
        currentTextChannel.send(`🎶 Now playing: **${songName}**`);
    }

    // Play the audio
    const resource = createAudioResource(nextSongPath);
    player.play(resource);
}

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async (message) => {
    // Ignore all non prefixed messages
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/+/);
    const command = args.shift().toLowerCase();

    if (command === 'play') {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.reply("You need to be in a voice channel to use this command!");
        }

        currentTextChannel = message.channel;
        playlist = loadShuffledPlaylist();

        if (playlist.length === 0) {
            return message.reply("The `music` folder is empty! Put some .mp3 files there first.");
        }

        // Connect to voice channel
        connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator,
        });

        // Initialize audio player if it doesn't exist
        if (!player) {
            player = createAudioPlayer();

            // When a song finishes, automatically play the next one
            player.on(AudioPlayerStatus.Idle, () => {
                playNext();
            });

            player.on('error', error => {
                console.error(`Error: ${error.message}`);
                playNext();
            });
        }

        connection.subscribe(player);
        message.channel.send(`🔀 Loaded and shuffled **${playlist.length}** songs. Starting playback!`);
        playNext();
    }

    if (command === 'skip') {
        if (player && player.state.status !== AudioPlayerStatus.Idle) {
            message.channel.send("⏭️ Skipped current track.");
            player.stop(); // This triggers the 'Idle' state listener, forcing playNext()
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
            message.channel.send("⏹️ Stopped playback and left the voice channel.");
        } else {
            message.reply("I'm not connected to a voice channel.");
        }
    }
});

// Toggle "Message Content Intent" in Discord Dev Portal for this token to work
client.login('YOUR_BOT_TOKEN_HERE');
