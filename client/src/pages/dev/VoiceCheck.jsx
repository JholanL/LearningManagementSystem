/**
 * DEV-ONLY sandbox (admin) for the voice engine — feature 1.
 * Try speechSynthesis (speak) and SpeechRecognition (listen), and see how the
 * recognised text scores against sample options and delivery rules.
 * Not in the sidebar; reach it at /dev/voice-check.
 */
import { useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Row } from 'react-bootstrap';
import PageHeader from '../../components/PageHeader';
import useVoice, { MOOD_PRESETS } from '../../hooks/useVoice';
import { matchResponse } from '../../utils/matchResponse';
import { countFillers, countWords } from '../../utils/deliveryMetrics';

const SAMPLE_LINE = "Hello? I just got my bill and there's an extra P850 charge I don't recognize! What is this?";
const SAMPLE_OPTIONS = [
  { index: 0, text: 'Thank you for calling Lumina, may I verify your account', keywords: ['thank you', 'verify', 'account'] },
  { index: 1, text: 'What is your account number', keywords: ['account number'] },
  { index: 2, text: 'Charges are usually correct, did you check your usage', keywords: ['correct', 'usage'] },
];

export default function VoiceCheck() {
  const voice = useVoice();
  const [line, setLine] = useState(SAMPLE_LINE);
  const [mood, setMood] = useState('frustrated');

  const spoken = voice.finalText || voice.interimText;
  const match = voice.finalText ? matchResponse(voice.finalText, SAMPLE_OPTIONS) : null;
  const { fillerCount, fillers } = countFillers(voice.finalText);

  return (
    <>
      <PageHeader title="Voice engine check" icon="bi-mic" subtitle="Dev sandbox for useVoice, matchResponse and delivery rules (admin only)." />

      {!voice.isSupported && (
        <Alert variant="warning">
          <i className="bi bi-exclamation-triangle me-2" />
          This browser does not support both speech APIs (TTS: {String(voice.supports.tts)}, STT: {String(voice.supports.stt)}). Use Chrome or Edge on desktop.
        </Alert>
      )}

      <Row className="g-3">
        {/* Speak (TTS) */}
        <Col md={6}>
          <Card className="h-100">
            <Card.Header>Customer voice — speechSynthesis</Card.Header>
            <Card.Body>
              <Form.Label htmlFor="line">Line to speak</Form.Label>
              <Form.Control id="line" as="textarea" rows={3} value={line} onChange={(e) => setLine(e.target.value)} className="mb-3" />
              <Form.Label htmlFor="mood">Mood (rate/pitch preset)</Form.Label>
              <Form.Select id="mood" value={mood} onChange={(e) => setMood(e.target.value)} className="mb-3">
                {Object.keys(MOOD_PRESETS).map((m) => (
                  <option key={m} value={m}>
                    {m} — rate {MOOD_PRESETS[m].rate}, pitch {MOOD_PRESETS[m].pitch}
                  </option>
                ))}
              </Form.Select>
              <div className="d-flex gap-2">
                <Button onClick={() => voice.speak(line, { mood })} disabled={!voice.supports.tts || voice.speaking}>
                  <i className="bi bi-play-fill me-1" /> Speak
                </Button>
                <Button variant="light" onClick={voice.cancel} disabled={!voice.speaking}>
                  Stop
                </Button>
                {voice.speaking && <Badge bg="success" className="align-self-center">speaking…</Badge>}
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Listen (STT) */}
        <Col md={6}>
          <Card className="h-100">
            <Card.Header>Agent mic — SpeechRecognition</Card.Header>
            <Card.Body>
              <div className="d-flex gap-2 mb-3">
                {!voice.listening ? (
                  <Button onClick={() => { voice.reset(); voice.startListening(); }} disabled={!voice.supports.stt}>
                    <i className="bi bi-mic-fill me-1" /> Start listening
                  </Button>
                ) : (
                  <Button variant="danger" onClick={voice.stopListening}>
                    <i className="bi bi-stop-fill me-1" /> Stop
                  </Button>
                )}
                <Button variant="light" onClick={voice.reset}>Clear</Button>
                {voice.listening && <Badge bg="danger" className="align-self-center">listening…</Badge>}
              </div>

              {voice.error && <Alert variant="danger" className="py-2">Error: <strong>{voice.error}</strong></Alert>}

              <Form.Label>Transcript</Form.Label>
              <div className="border rounded p-2 bg-white" style={{ minHeight: 80 }}>
                <span>{voice.finalText}</span> <span className="text-muted fst-italic">{voice.interimText}</span>
                {!spoken && <span className="text-muted">Say something after pressing Start…</span>}
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Analysis */}
        <Col xs={12}>
          <Card>
            <Card.Header>Analysis of the recognised text</Card.Header>
            <Card.Body>
              {!voice.finalText ? (
                <p className="text-muted mb-0">Capture a final transcript above to see matching + delivery readouts.</p>
              ) : (
                <Row className="g-3">
                  <Col md={6}>
                    <h3 className="h6">matchResponse → sample options</h3>
                    {match?.best ? (
                      <p className="mb-2">
                        Best: <strong>#{match.best.index}</strong> — {match.best.text}{' '}
                        <Badge bg={match.confident ? 'success' : 'secondary'}>
                          {match.viaCommand ? 'via command' : `score ${match.best.score}`} · {match.confident ? 'confident' : 'ask "did you mean?"'}
                        </Badge>
                      </p>
                    ) : (
                      <p className="text-muted">No match.</p>
                    )}
                    <ul className="small mb-0">
                      {match?.candidates.map((c) => (
                        <li key={c.index}>#{c.index} — score {c.score} — {c.text}</li>
                      ))}
                    </ul>
                  </Col>
                  <Col md={6}>
                    <h3 className="h6">delivery (text-only readout)</h3>
                    <p className="mb-1">Words: <strong>{countWords(voice.finalText)}</strong></p>
                    <p className="mb-1">Fillers: <strong>{fillerCount}</strong> {fillerCount > 0 && <span className="text-muted">({Object.entries(fillers).map(([k, v]) => `${k}×${v}`).join(', ')})</span>}</p>
                    <p className="text-muted small mb-0">WPM and dead-air need live timing; those are computed on the server from the per-turn timing.</p>
                  </Col>
                </Row>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  );
}
