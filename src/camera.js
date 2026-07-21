export async function iniciarCamara(video){
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
    audio: false
  });
  // Enfoque continuo si el dispositivo lo expone (Fase 9): mejor nitidez apuntando
  // hacia abajo a facturas pequeñas. Best-effort — si el navegador no lo soporta
  // (iOS viejo), se ignora en silencio y la camara arranca igual.
  try {
    const track = stream.getVideoTracks()[0];
    const caps = track.getCapabilities ? track.getCapabilities() : {};
    if (Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')){
      await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
    }
  } catch(e){ console.warn('Enfoque continuo no disponible:', e.message); }
  video.srcObject = stream;
  await video.play();
  return stream;
}

export function capturarFrame(video){
  const c = document.createElement('canvas');
  c.width = video.videoWidth;
  c.height = video.videoHeight;
  c.getContext('2d').drawImage(video, 0, 0);
  return c;
}
