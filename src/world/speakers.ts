import { AudioContext as ThreeAudioContext, AudioListener, PositionalAudio, type Camera, type Scene, type Vector3 } from 'three';
import type { Spatializer } from '../audio/music';

/**
 * Positional audio: the FOH music comes out of the line arrays on the stage. The listener sits on
 * the camera, so when the camera travels to a booth on the right the stage sounds from the left,
 * and looking around (cursor, drag) turns the sound with you.
 */
export function createSpeakers(scene: Scene, camera: Camera, positions: Vector3[]): Spatializer {
  return (context, input) => {
    // Three.js must use the music's audio context, so its nodes can be connected to it.
    ThreeAudioContext.setContext(context);
    const listener = new AudioListener();
    camera.add(listener);

    const speakers = positions.map((position) => {
      const speaker = new PositionalAudio(listener);
      speaker.position.copy(position);
      // Loud near the stage, still clearly audible (and directional) at the far booths.
      speaker.setDistanceModel('inverse');
      speaker.setRefDistance(10);
      speaker.setRolloffFactor(0.8);
      // Two speakers play the same mix, so each at half level.
      speaker.setVolume(0.6);
      scene.add(speaker);
      input.connect(speaker.panner);
      return speaker;
    });
    scene.updateMatrixWorld();
    camera.updateMatrixWorld();

    return () => {
      input.disconnect();
      for (const speaker of speakers) {
        speaker.panner.disconnect();
        speaker.gain.disconnect();
        speaker.removeFromParent();
      }
      listener.gain.disconnect();
      camera.remove(listener);
    };
  };
}
