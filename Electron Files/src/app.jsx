/*
   Author: Matthias Schott
   ProjectName: Melody Helpr
 */

import React from "react";
import osc from "osc-min";
import udp from "dgram";
import fs from "fs";
import os from "os";
import * as mm from "@magenta/music";
import { Chord, Note, Interval } from "tonal";
import * as Key from "tonal-key";
import { chord } from "tonal-detect";
import {
  Button,
  ButtonToolbar,
  Card,
  Col,
  Container,
  CustomMenu,
  CustomToggle,
  Dropdown,
  Form,
  InputGroup,
  Row,
  Spinner
} from "react-bootstrap";
// usr class imports
import ChordView from "./chordview";
import Dialog from "./dialog";
import Status from "./status";
import NotePlayer from "./noteplayer";
import { sequences, NoteSequence } from "@magenta/music";
import { ChordSymbols } from "@magenta/music/es5/core/chords";
// usr vars
const homeDir = os.homedir();
const tempDir = homeDir.concat("/ardour_electron");
const connFile = "/connected.txt";
const chordsFile = "/chordsNew.mid";
const chordsFileArdour = "/chords.mid";
const melodyFile = "/melody.mid";
// standard chord progression
const CHORDS = ["C", "G", "Am", "F", "C", "G", "Am", "F"];

export default class App extends React.Component {
  constructor(props) {
    super(props);
    this.sock = {};
    this.udp_port = 7890;
    this.state = {
      canvasClicked: false,
      loading: true,
      temperature: 1.0,
      qpm: 120,
      divisions: 4,
      divisor: 4,
      noBars: 2,
      stepsPerBar: 16,
      chordProgression: CHORDS,
      noteSequence: null,
      showDialog: false,
      temperature: 0.7,
      status: "waiting"
    };
    this.checkpointPath =
      "https://storage.googleapis.com/magentadata/js/checkpoints/";
    this.generateSequence = this.generateSequence.bind(this);
    this.updateTemperatureValue = this.updateTemperatureValue.bind(this);
    this.showDialog = this.showDialog.bind(this);
    this.togglePlayback = this.togglePlayback.bind(this);
    this.transferToArdour = this.transferToArdour.bind(this);
    this.doubleSequence = this.doubleSequence.bind(this);
    this.halveSequence = this.halveSequence.bind(this);
    this.openSocket = this.openSocket.bind(this);
    this.importChords = this.importChords.bind(this);
    this.splitChords = this.splitChords.bind(this);
    this.randomizeChords = this.randomizeChords.bind(this);
    // this.model = null;
  }
  componentDidMount() {
    this.openSocket();
  }
  async generateSequence() {
    // toggle loading state, reset chord progression array, etc.
    const chordProg =
      this.state.status === "presets" ? CHORDS : this.state.chordProgression;
    this.setState({
      loading: true,
      noBars: 2,
      canvasClicked: false,
      chordProgression: chordProg
    });
    // create and init magenta model
    const musicVAE = new mm.MusicVAE(
      "https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/mel_chords"
    );
    await musicVAE.initialize();
    /* note:
     * the length of the sequence depends on the checkpoint + config file passed to the constructor of the model,
     * steps per quarter can either be 3 or 4 (for now!)
     */
    const sample = await musicVAE.sample(
      1,
      this.state.temperature,
      this.state.chordProgression.slice(0, 2),
      this.state.divisor,
      this.state.qpm
    );
    // grab first element of returned inotesequence array
    let sequence = sample[0];
    // make sure that notes are in range (48 - 83) for the improvRNN model (see doubleSequence function)
    const notes = sequence.notes.map(noteObj => {
      if (noteObj.pitch < 48) {
        // Math.ceil = return next larger integer no
        noteObj.pitch += Math.ceil((48 - noteObj.pitch) / 12) * 12;
      } else if (noteObj.pitch > 83) {
        noteObj.pitch -= Math.ceil((noteObj.pitch - 83) / 12) * 12;
      }
      return noteObj;
    });
    sequence.notes = notes;

    this.setState({
      noteSequence: sequence,
      loading: false
    });
    musicVAE.dispose;
  }
  importChords() {
    mm.urlToNoteSequence(tempDir.concat(chordsFileArdour)).then(noteSeq => {
      this.splitChords(noteSeq);
    });
  }
  // split chords file into one bar chunks
  splitChords(noteSeq) {
    let chordList = [];
    let chordsStatus = "custom";
    // create variable to check whether chords are detected in the midi file provided
    let hasChords = false;
    // check if noteSeq is empty
    if (noteSeq.notes.length === 0) {
      alert(
        "There are no notes in the region provided. Using presets for now."
      );
      chordsStatus = "presets";
    } else {
      // quantize sequence
      const quantSeq = mm.sequences.quantizeNoteSequence(
        noteSeq,
        this.state.divisor // generally set to quarters?
      );
      // (TODO: replace hard coded no)
      const beatsPerBars = this.state.divisions * 4;
      const noOfBarsProvided = Math.ceil(
        quantSeq.totalQuantizedSteps / beatsPerBars
      );
      /* make sure that the length of the imported chords file is a multiple of 2,
       * additionally restrict chord detection to one bar chunks (might be changed later)
       */
      const barsWithChords = Math.pow(
        2,
        Math.ceil(Math.log2(noOfBarsProvided))
      );
      const noOfBars = barsWithChords >= 2 ? barsWithChords : 2;

      for (let i = 0; i < noOfBars; i++) {
        // detect chords starting at the start of bar chunks
        const chordsDetected = chord(
          quantSeq.notes
            .filter(noteObj => noteObj.quantizedStartStep === i * beatsPerBars)
            .map(note => {
              return Note.fromMidi(note.pitch);
            })
        );
        // insert 'N.C' string when chord info is missing or chord could not have been detected
        if (!chordsDetected.length) {
          chordList.push(mm.constants.NO_CHORD);
          continue;
        }
        hasChords = true;
        // get first element of the array of chords returned by the chord method of the tonal library
        const chordInBar = chordsDetected[0];
        // omit the following chord symbols (due to chord encoder used with MusicVae model!)
        const chordToOmit =
          chordInBar.indexOf("64") & chordInBar.indexOf("sus");
        chordList.push(
          chordToOmit === -1 ? chordInBar : chordInBar.slice(0, chordToOmit)
        );
      }
      /* handle special cases:
	     1) no chords detected,
	     2) not every bar has chords in it 
	   */
      if (!hasChords) {
        alert("Could not detect any chord. Using presets for now.");
        chordsStatus = "presets";
      } else {
        // iterate over empty indices and fill rest of chord prog list
        for (let i = 0; i < chordList.length; i++) {
          if (chordList[i] === mm.constants.NO_CHORD) {
            chordList[i] = chordList.find(function(el) {
              return el !== mm.constants.NO_CHORD;
            });
          }
        }
      }
    }
    let chordProg =
      chordsStatus === "custom" ? chordList : this.state.chordProgression;
    this.setState({
      chordProgression: chordProg,
      // noBars: noOfBars,
      status: chordsStatus
    });
  }

  openSocket() {
    // get this context from class to use in inner function below (renaming necessary)
    const _this = this;
    this.sock = udp.createSocket("udp4", function(msg, rinfo) {
      let error, error1;
      try {
        // handle messages sent from Ardour (destructering of incoming msgs)
        if (osc.fromBuffer(msg)["address"] === "SEQ_INFO") {
          _this.setState({
            qpm: osc.fromBuffer(msg)["args"][0].value,
            divisions: osc.fromBuffer(msg)["args"][1].value,
            divisor: osc.fromBuffer(msg)["args"][2].value,
            status: "presets",
            canvasClicked: false
          });
          // check if boolean flag (exp_chords) in Ardour has been set
          if (osc.fromBuffer(msg)["args"][3].value === true) {
            _this.importChords();
          }
          // automatically create sequence (later on a button could be provided)
          _this.generateSequence();
        }
        // establish connection with Ardour (basic fs check for now)
        if (osc.fromBuffer(msg)["address"] === "CONNECT") {
          fs.writeFile(tempDir.concat(connFile), "connect", "utf8", err => {
            if (err) throw err;
            console.log("The file has been written!");
          });
        }
        return console.log(osc.fromBuffer(msg));
      } catch (error1) {
        error = error1;
        return console.log("Error: ", error);
      }
    });
    this.sock.bind(this.udp_port);
  }
  updateTemperatureValue(event) {
    let val = parseFloat(event);
    this.setState({
      temperature: val
    });
  }
  showDialog() {
    this.setState({
      showDialog: true
    });
  }
  togglePlayback() {
    this.setState(prevState => {
      return { canvasClicked: !prevState.canvasClicked };
    });
  }
  transferToArdour() {
    const midi = mm.sequenceProtoToMidi(this.state.noteSequence);
    // check first if chords should be exported, order important here
    if (this.state.status === "presets") {
      // setup output note sequence
      let ns = NoteSequence.create({
        quantizationInfo: { stepsPerQuarter: this.state.divisor },
        tempos: [{ qpm: this.state.qpm }]
      });
      /* ns.timeSignatures.push(
       *   NoteSequence.TimeSignature.create({
       *     time: 0,
       *     numerator: 4,
       *     denominator: 4
       *   })
       * ); */
      for (let i = 0; i < this.state.noBars; i++) {
        const chordInBar = this.state.chordProgression[i];
        const root = ChordSymbols.root(chordInBar);
        // const chordPitches = ChordSymbols.pitches(chordInBar);
        const intervals = Chord.intervals(chordInBar).map(interval =>
          Interval.chroma(interval)
        );
        let note = {};
        intervals.forEach(distance => {
          note = new NoteSequence.Note({
            pitch: 48 + root + distance, // start from c3 and add 0-11 (see return from ChordSymbols.pitches())
            quantizedStartStep: i * this.state.stepsPerBar,
            quantizedEndStep: (i + 1) * this.state.stepsPerBar
          });
          ns.notes.push(note);
        });
      }
      ns.totalQuantizedSteps = this.state.noBars * this.state.stepsPerBar;
      const quantSeq = mm.sequences.quantizeNoteSequence(
        ns,
        this.state.divisor
      );
      const midiChords = mm.sequenceProtoToMidi(ns);
      fs.writeFileSync(tempDir.concat(chordsFile), midiChords);
    }
    fs.writeFileSync(tempDir.concat(melodyFile), midi);
  }

  async doubleSequence() {
    // toggle loading state
    this.setState({
      loading: true
    });
    const improvRnn = new mm.MusicRNN(
      "https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/chord_pitches_improv"
    );
    await improvRnn.initialize();

    const outputLength = this.state.stepsPerBar * this.state.noBars;

    console.log(
      "provided chord prog: ",
      this.state.chordProgression.slice(
        this.state.noBars,
        this.state.noBars * 2
      )
    );
    // const start = performance.now();
    const continuation = await improvRnn.continueSequence(
      this.state.noteSequence,
      outputLength,
      this.state.temperature,
      this.state.chordProgression.slice(
        this.state.noBars,
        this.state.noBars * 2
      )
    );

    const concatenated_sequence = sequences.concatenate([
      this.state.noteSequence,
      continuation
    ]);

    this.setState(prevState => {
      return {
        noteSequence: concatenated_sequence,
        loading: false,
        noBars: prevState.noBars * 2
      };
    });

    improvRnn.dispose();
  }
  halveSequence() {
    // toggle loading state
    this.setState({
      loading: true
    });

    const halvedSequence = sequences.split(
      this.state.noteSequence,
      (this.state.stepsPerBar * this.state.noBars) / 2
    );

    this.setState(prevState => {
      return {
        noteSequence: halvedSequence[0],
        loading: false,
        noBars: prevState.noBars / 2
      };
    });
  }
  randomizeChords() {
    // build up available keys
    const roots = ["C", "D", "F", "G", "A"];
    const keys = ["major", "minor"];
    // pick key to choose chords from
    const pickedKey =
      roots[Math.floor(Math.random() * Math.floor(roots.length))] +
      keys[Math.round(Math.random())];
    // build up available chords from picked key
    const chordsToChooseFrom = Key.triads(pickedKey).concat(
      Key.chords(pickedKey),
      Key.secDomChords(pickedKey)
    );
    // create new chord progression list
    let newChordProgression = [];
    for (let i = 0; i < this.state.chordProgression.length; i++) {
      console.log(
        "new chords: ",
        chordsToChooseFrom[
          Math.floor(Math.random() * Math.floor(chordsToChooseFrom.length))
        ]
      );
      newChordProgression.push(
        chordsToChooseFrom[
          Math.floor(Math.random() * Math.floor(chordsToChooseFrom.length))
        ]
      );
    }
    this.setState({
      chordProgression: newChordProgression
    });
  }

  render() {
    return (
      <Container variant="dark">
        <Row>
          <Col>
            <h1 className="heading">Melody Helpr</h1>
          </Col>
        </Row>
        <Row>
          <Col>
            <Card className="text-center">
              <Card.Header>
                <Status status={this.state.status} />
                <Spinner
                  animation="border"
                  role="status"
                  className="main-spinner"
                  style={{ display: this.state.loading ? "block" : "none" }}
                />
              </Card.Header>
              <Card.Body>
                <p className="chord-list">
                  {`bpm: ${this.state.qpm} | time: 4/4 | bars: ${
                    this.state.noBars
                  } ${
                    this.state.divisor === 3 ? "| triplets" : ""
                  } | randomness: ${this.state.temperature}`}
                </p>

                <Container
                  className={`surr-canvas ${
                    this.state.canvasClicked ? "selected" : ""
                  }`}
                  onClick={this.togglePlayback}
                >
                  <NotePlayer
                    play={this.state.canvasClicked}
                    notes={this.state.noteSequence}
                    style={{ display: "none" }}
                  />
                </Container>
                <ChordView
                  chords={this.state.chordProgression.slice(
                    0,
                    this.state.noBars
                  )}
                />
              </Card.Body>
              <Card.Footer>
                <Row>
                  {/* <Button
					style={showDialogBtnBg}
					variant="outline-secondary"
					onClick={this.showDialog}
					/> */}
                  {/* <Col xs="auto">
					<Button
					variant="outline-secondary"
					onClick={this.generateSequence}
					>
					Generate
					</Button>
					</Col> */}
                  <Col>
                    <Button
                      variant="outline-secondary"
                      onClick={this.transferToArdour}
                      disabled={this.state.loading || this.state.canvasClicked}
                    >
                      Transfer
                    </Button>
                  </Col>

                  <Col
                    lg={{ offset: 6 }}
                    md={{ offset: 2, span: 5 }}
                    sm={{ offset: 0, span: 8 }}
                    xs={{ offset: 2, span: 8 }}
                  >
                    <Button
                      variant="outline-secondary"
                      onClick={this.halveSequence}
                      disabled={
                        this.state.loading ||
                        this.state.canvasClicked ||
                        this.state.noBars === 2
                      }
                    >
                      :2
                    </Button>
                    <Button
                      variant="outline-secondary"
                      onClick={this.doubleSequence}
                      disabled={
                        this.state.loading ||
                        this.state.canvasClicked ||
                        this.state.noBars === 8 ||
                        this.state.chordProgression.length <
                          this.state.noBars * 2
                      }
                    >
                      x2
                    </Button>

                    <Dropdown onSelect={this.updateTemperatureValue}>
                      <Dropdown.Toggle
                        variant="outline-secondary"
                        id="dropdown-basic"
                        disabled={
                          this.state.loading || this.state.canvasClicked
                        }
                      >
                        <i className="fas fa-random" />
                      </Dropdown.Toggle>
                      <Dropdown.Menu>
                        <Dropdown.Item eventKey="0.5">0.5</Dropdown.Item>
                        <Dropdown.Item eventKey="0.7">0.7</Dropdown.Item>
                        <Dropdown.Item eventKey="1.0">1.0</Dropdown.Item>
                        <Dropdown.Item eventKey="1.5">1.5</Dropdown.Item>
                      </Dropdown.Menu>
                    </Dropdown>
                    <Button
                      variant="outline-secondary"
                      onClick={this.randomizeChords}
                      disabled={this.state.loading || this.state.canvasClicked}
                    >
                      <i className="fas fa-music" />
                    </Button>
                  </Col>
                </Row>
              </Card.Footer>
            </Card>
          </Col>
        </Row>
        <Row className="justify-content-md-center" />
      </Container>
    );
  }
}
