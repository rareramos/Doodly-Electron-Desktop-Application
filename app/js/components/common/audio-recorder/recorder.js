import AudioContext from './audio-context';

let analyser;
let audioCtx;
let mediaRecorder;
let chunks = [];
let startTime;
let stream;
let mediaOptions;
let blobObject;
let onStartCallback;
let onStopCallback;
let onDataCallback;

const constraints = { audio: true, video: false }; // constraints - only audio needed

navigator.getUserMedia = (navigator.getUserMedia ||
                          navigator.webkitGetUserMedia ||
                          navigator.mozGetUserMedia ||
                          navigator.msGetUserMedia);

export default class MicrophoneRecorder {
  constructor(onStart, onStop, onData, options) {
    onStartCallback= onStart;
    onStopCallback= onStop;
    onDataCallback= onData;
    mediaOptions= options;
  }

  startRecording=() => {

    startTime = Date.now();

    if(mediaRecorder) {

      if(audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      if(mediaRecorder && mediaRecorder.state === 'paused') {
        mediaRecorder.resume();
        return;
      }

      if(audioCtx && mediaRecorder && mediaRecorder.state === 'inactive') {
        mediaRecorder.start(10);
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        if(onStartCallback) { onStartCallback() };
      }
    } else {
      if (navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia(constraints).then((str) => {
          stream = str;
          if(onStartCallback) { onStartCallback() };

          if(MediaRecorder.isTypeSupported(mediaOptions.mimeType)) {
            mediaRecorder = new MediaRecorder(str, mediaOptions);
          } else {
            mediaRecorder = new MediaRecorder(str);
          }

          mediaRecorder.onstop = this.onStop;
          mediaRecorder.ondataavailable = (event) => {
            chunks.push(event.data);
            if (onDataCallback) onDataCallback({
              duration: Date.now() - startTime,
              chunk: event.data
            });
          }

          audioCtx = AudioContext.getAudioContext();
          analyser = AudioContext.getAnalyser();

          mediaRecorder.start(10);

          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);

        });
      } else {
        alert('Your browser does not support audio recording');
      }
    }

  }

  stopRecording() {
    if(mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      audioCtx.suspend();
    }
  }

  onStop(evt) {
    const blob = new Blob(chunks, { 'type' : mediaOptions.mimeType });
    chunks = [];

    const blobObject =  {
      blob      : blob,
      duration  : Date.now() - startTime,
      options   : mediaOptions,
      blobURL   : URL.createObjectURL(blob)
    }

    if(onStopCallback) { onStopCallback(blobObject) };

  }

}