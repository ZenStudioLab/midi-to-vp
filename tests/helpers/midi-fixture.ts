import { Midi } from '@tonejs/midi';

export function createMidiFixture(): Uint8Array {
  const midi = new Midi();
  midi.header.setTempo(120);

  const melody = midi.addTrack();
  melody.channel = 0;
  melody.addNote({ midi: 60, time: 0, duration: 0.125, velocity: 0.8 });
  melody.addNote({ midi: 64, time: 0, duration: 0.125, velocity: 0.76 });
  melody.addNote({ midi: 62, time: 0.125, duration: 0.125, velocity: 0.82 });
  melody.addNote({ midi: 74, time: 0.5, duration: 0.125, velocity: 0.9 });

  const percussion = midi.addTrack();
  percussion.channel = 9;
  percussion.addNote({ midi: 36, time: 0.125, duration: 0.125, velocity: 0.6 });

  return new Uint8Array(midi.toArray());
}

export function createRangeStressMidi(): Uint8Array {
  const midi = new Midi();
  midi.header.setTempo(120);

  const track = midi.addTrack();
  track.channel = 0;
  track.addNote({ midi: 24, time: 0, duration: 0.25, velocity: 0.8 });
  track.addNote({ midi: 31, time: 0.125, duration: 0.25, velocity: 0.8 });
  track.addNote({ midi: 108, time: 0.25, duration: 0.25, velocity: 0.8 });
  track.addNote({ midi: 112, time: 0.375, duration: 0.25, velocity: 0.8 });

  return new Uint8Array(midi.toArray());
}

export function createDenseChordMidi(): Uint8Array {
  const midi = new Midi();
  midi.header.setTempo(120);

  const track = midi.addTrack();
  track.channel = 0;

  const midiNotes = [60, 64, 67, 71, 74, 77];
  midiNotes.forEach((note, index) => {
    track.addNote({ midi: note, time: 0, duration: 0.25, velocity: 0.7 + index * 0.03 });
  });

  return new Uint8Array(midi.toArray());
}

export function createSustainMidi(): Uint8Array {
  const midi = new Midi();
  midi.header.setTempo(120);

  const track = midi.addTrack();
  track.channel = 0;
  track.addNote({ midi: 60, time: 0, duration: 0.375, velocity: 0.8 });
  track.addNote({ midi: 62, time: 0.5, duration: 0.125, velocity: 0.8 });

  return new Uint8Array(midi.toArray());
}
