const express = require('express');
const port = 3948;
const bodyParser = require('body-parser')
const TelegramBot = require("node-telegram-bot-api");
const ytdl = require("ytdl-core");
const fs = require("fs");

const app = express();
app.use(bodyParser.json());

require("dotenv").config();

app.set("view engine", "ejs");

const token = process.env.B; // Replace YOUR_BOT_TOKEN with your actual bot token
const bot = new TelegramBot(token, { polling: false });
let v_id = ' '
let yt_link = ' '

app.listen(port, () => {
   console.log(`DogeUtube Server started on port ${port}`);
});

app.get("/", (req, res) => {
   return res.render("index");
});

app.get("/download", async(req, res) => {
    try {
      v_id = req.query.url.split('v=')[1];
    } catch (error) {
      console.log(error);
    }
	if (ytdl.validateURL(req.query.url)) {
      const info = await ytdl.getInfo(req.query.url);
//      console.log(info.formats[4]);
//      console.log(info.formats[1]);
      console.log(`New Video Id: ${req.query.url} \n https://youtube.com/watch?v=${v_id}`);

	  return res.render("download", {
		  url: "https://www.youtube.com/embed/" + v_id,
          info: info.formats.sort((a, b) => {
              return a.mimeType < b.mimeType;
          }),
	  });
	} else {
	  return res.render("index");
	}
});

app.get(['/api/video', '/api/video/*'], function (req, res) {
  try {
    yt_link = `https://m.youtube.com/watch?v=${req.params[0]}`

  } catch (error) {
    res.send(error)
    console.log(error);
  }
  downVideo(yt_link, res);
});

app.get(['/api/audio', '/api/audio/*'], function (req, res) {
  try {
    yt_link = `https://m.youtube.com/watch?v=${req.params[0]}`
    console.log(`New Video Id: ${yt_link} \n https://youtube.com/watch?v=${yt_link}`);
  } catch (error) {
    res.send(error)
    console.log(error);
  }
  downAudio(yt_link, res);
});

app.use(function(req, res) {
   res.status(404).send('Page Not found') 
});






// Listen for the /yt command
bot.onText(/\/yt/, (msg) => {
  const chatId = msg.chat.id;
  const url = msg.text.split(" ")[1];

  if (ytdl.validateURL(url)) {
    downloadVideo(chatId, url);
  } else {
    bot.sendMessage(chatId, "Invalid YouTube URL.");
  }
});

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  // Send a message with the introduction and instructions
  bot.sendMessage(
    chatId,
    `Hey, I am TsuyuDL made by @TsuyuOfficial. Use the following commands to use me! 

/yt - Give any youtube link and TsuyuDL will download it for you.`
  );
});






async function downVideo(url, res) {
  try {
    if (ytdl.validateURL(url)) {
      const videoInfo = await ytdl.getInfo(url);
      const audioFormats = ytdl.filterFormats(videoInfo.formats, 'videoonly');
      res.send(audioFormats)
    } else {
      res.send("Invalid YouTube URL.")
    }
  } catch (error) {
    res.send("Error downloading video.")
    console.error(error);
  }
}
async function downAudio(url, res) {
  try {
    if (ytdl.validateURL(url)) {
      const videoInfo = await ytdl.getInfo(url);
      const audioFormats = ytdl.filterFormats(videoInfo.formats, 'audioonly');
      res.send(audioFormats)
    } else {
      res.send("Invalid YouTube URL.")
    }
  } catch (error) {
    res.send("Error downloading video.")
    console.error(error);
  }
}

// Function to download a YouTube video and send it as a video file
async function downloadVideo(chatId, url) {
  try {
    // Get video information and thumbnail URL
    const videoInfo = await ytdl.getInfo(url);
    const title = videoInfo.player_response.videoDetails.title;
    const thumbnailUrl =
      videoInfo.videoDetails.thumbnails[
        videoInfo.videoDetails.thumbnails.length - 1
      ].url;
    // Send a message to show the download progress
    const message = await bot.sendMessage(
      chatId,
      `*Downloading video:* ${title}`
    );

    // Create a writable stream to store the video file
    const writeStream = fs.createWriteStream(`${title}-${chatId}.mp4`);

    // Start the download and pipe the video data to the writable stream
    ytdl(url, { filter: "audioandvideo" }).pipe(writeStream);

    // Set up an interval to update the message with the download progress every 5 seconds
    let progress = 0;
    const updateInterval = setInterval(() => {
      progress = writeStream.bytesWritten / (1024 * 1024);
      bot.editMessageText(
        `*Downloading video:* ${title} (${progress.toFixed(2)} MB) \u{1F4E6}`,
        {
          chat_id: chatId,
          message_id: message.message_id,
          parse_mode: "Markdown", // use Markdown formatting
        }
      );
    }, 2000);

    // When the download is complete, send the video and delete the file
    writeStream.on("finish", () => {
      clearInterval(updateInterval); // stop updating the message
      bot
        .sendVideo(chatId, `${title}-${chatId}.mp4`, {
          caption: `*Video downloaded:* ${title} "by" @TsuyuOfficial 🏯`,
          thumb: thumbnailUrl,
          duration: videoInfo.videoDetails.lengthSeconds,
          parse_mode: "Markdown",
        })

        .then(() => {
          fs.unlinkSync(`${title}-${chatId}.mp4`); // delete the file
        })
        .catch((error) => {
          bot.sendMessage(chatId, "Error sending video.");
          console.error(error);
        });
    });
  } catch (error) {
    bot.sendMessage(chatId, "Error downloading video.");
    console.error(error);
  }
}
