import React from "react";
import * as mm from "@magenta/music";
import { Container } from "react-bootstrap";

class NotePlayer extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isPlaying: false
    };
    this.player = null;
    this.visualizer = null;
  }
  buildVisualizer(notes) {
    this.visualizer = new mm.PianoRollCanvasVisualizer(
      notes,
      document.getElementById("canvas")
    );
  }
  componentDidMount() {
    this.player = new mm.Player(false, {
      run: note => {
        this.visualizer.redraw(note);
        this.setState({
          noteToPlay: note
        });
      },
      stop: () => {
        this.player.start(this.props.notes);
      }
    });
  }
  componentWillReceiveProps(nextProps) {
    // recreate visualizer when notes change (simple redraw does not work!)
    if (nextProps.notes !== this.props.notes) {
      this.buildVisualizer(nextProps.notes);
    }
    if (nextProps.play) {
      this.player.resumeContext();
      this.player.start(nextProps.notes);
    } else {
      this.player.stop();
    }
  }
  // prevent component from updating (third party lib handles redrawing itself)
  shouldComponentUpdate() {
    return false;
  }
  render() {
    return <canvas id="canvas" />;
  }
}

export default NotePlayer;
