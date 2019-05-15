import React from "react";
import { Col, Row } from "react-bootstrap";

function ChordView(props) {
  const chordColumns = props.chords.map((chord, idx) => {
    return <Col key={idx}>{chord}</Col>;
  });

  return <Row>{chordColumns}</Row>;
}

export default ChordView;
