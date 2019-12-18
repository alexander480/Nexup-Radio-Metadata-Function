/*jshint esversion: 6 */

const fs = require("fs");
const stream = require('stream');
const mm = require("musicmetadata");

const functions = require('firebase-functions');
const admin = require('firebase-admin');

const mkdirp = require('mkdirp-promise');
const gcs = require('@google-cloud/storage')();
const path = require('path');
const os = require('os');

admin.initializeApp(functions.config().firebase);

exports.songUpload = functions.storage.object().onChange(event =>
{
    if (event.data.resourceState == 'exists')
    {
      console.log("Initializing Song Upload Function...");
      getMetadata();
    }
  
    // ---------- Main Functions ---------- //
  
    function getMetadata()
    {
      const tempPath = os.tmpdir();
      
      const object = event.data;
      const bucket = gcs.bucket(object.bucket);
      
      const tempSongPath = path.join(tempPath, 'song.mp3');
      
      bucket.file(object.name).download({ destination: tempSongPath }).then(() => {
        console.log("Song Downloaded To Temporary Storage.");
        
        var readableStream = fs.createReadStream(tempSongPath);
        var parser = mm(readableStream, function (err, metadata) 
        {
          if (err) throw err;
          if (metadata) 
          { 
            console.log("Got Song Metadata."); 
            console.log(metadata); 
            
            var song = {
                name: metadata.title,
                artist: metadata.artist[0],
                genre: metadata.genre[0],
                picture: metadata.picture[0].data.toString('base64')
            };    
            
            readableStream.close();
            
            sendToDatabase(object, song);
          }
        });
      });
    }
  
    function sendToDatabase(object, song)
    {
      var db = admin.database();
      var songRef = db.ref("/audio/setlist/" + song.name);
      const data = song.picture;
      
      if (data !== undefined)
      {
        const tempPath = os.tmpdir();
        const tempPicPath = path.join(tempPath, 'image_decoded.jpg');

        fs.writeFile(tempPicPath, data, function(err) 
        {
          if (err) 
          { 
            console.log("Error Decoding Image"); 
          }
          else
          {
            songRef.set({
              Name: song.name,
              Artist: song.artist,
              Genre: song.genre,
              Playlist: getPlaylist(song.genre),
              Picture: "Success!",
              Storage: getStorage(object),
              isFeatured: false
            });
            
            console.log(tempPicPath);
          }
        });
      }
      else
      {
        songRef.set({
          Name: song.name,
          Artist: song.artist,
          Genre: song.genre,
          Playlist: getPlaylist(song.genre),
          Picture: "Error!",
          Storage: getStorage(object),
          isFeatured: false
        });
      }
    }
  
    // --------- Background Functions --------- //
  
    function getPlaylist(genre)
    {
      var playlist = String();
      var upperGenre = genre.toUpperCase();

      if (upperGenre.includes("HIP HOP") || upperGenre.includes("HIP-HOP") || upperGenre.includes("RAP")) {
        playlist = "Hip Hop";
      }
      else if (upperGenre.includes("R&B") || upperGenre.includes("RB") || upperGenre.includes("R AND B") || upperGenre.includes("SOUL") || upperGenre.includes("R & B")) {
        playlist = "R&B";
      }
      else if (upperGenre.includes("GOSPEL") || upperGenre.includes("PRAISE") || upperGenre.includes("CHRISTIAN")) {
        playlist = "Gospel";
      }
      else if (upperGenre.includes("JAZZ")) {
        playlist = "Jazz";
      }
      else {
        playlist = "";
      }

      return playlist;
    }
  
    function getStorage(Object)
    {
      var link = "gs://" + Object.bucket + "/" + Object.name;
      return link;
    }
});

