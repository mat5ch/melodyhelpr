import React from "react";
import { Card, Col, Container, Row, Spinner } from "react-bootstrap";

class Status extends React.Component {
  constructor(props) {
    super();
    this.state = {
      texts: {
        loading: "Loading",
        waiting: "Waiting for Script in Ardour",
        presets: "Created Melody with preset chords",
        custom: "Created Melody with custom chords"
      }
    };
  }
  render() {
    return (
      <h5>{this.state.texts[this.props.status]}</h5>
      /* <span className="time-info">
		Bars: {this.props.timeInfo.no_bars}, BPM: {this.props.timeInfo.bpm},
		Measure: {this.props.timeInfo.no_beats}/{this.props.timeInfo.measure}
		</span> */
    );
  }
}

export default Status;
