import React from "react";
import { Button, Col, Form, Modal } from "react-bootstrap";

class Dialog extends React.Component {
  constructor(props) {
    super(props);
  }
  render() {
    return (
      <Modal
        {...this.props}
        size="lg"
        aria-labelledby="contained-modal-title-vcenter"
        centered
      >
        <Modal.Header>
          <Modal.Title id="contained-modal-title-vcenter">
            Set Params
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Row>
              <Form.Group as={Col} controlId="formCheckpoint">
                <Form.Label>Checkpoint</Form.Label>
                <Form.Control as="select">
                  <option>Choose...</option>
                  <option>4bar simple</option>
                  <option>4bar adv</option>
                </Form.Control>
              </Form.Group>
              <Form.Group as={Col} controlId="formTemperature">
                <Form.Label>Randomness</Form.Label>
                <Form.Control
                  type="number"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  placeholder="0.7"
                  /* value={this.state.temperature}
                  onChange={this.updateTemperatureValue} */
                />
              </Form.Group>
              <Form.Group as={Col} controlId="formSeqLength">
                <Form.Label>Output Length</Form.Label>
                <Form.Control as="select" disabled>
                  <option>No of bars...</option>
                  <option>2</option>
                  <option>4</option>
                  <option>8</option>
                  <option>16</option>
                </Form.Control>
              </Form.Group>
            </Form.Row>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-dark" onClick={this.props.onHide}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    );
  }
}

export default Dialog;
