/**
 * Agent → Call in progress (/agent/simulator/:id).
 * A chat-style simulated call with Voice or Text mode.
 * Voice: the customer line is spoken aloud; the agent answers with push-to-talk,
 * matchResponse picks the option (or asks "Did you mean…?"), and the server scores
 * both content (what) and delivery (how). Text mode keeps clickable options.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, Badge, Button, Card, Col, Modal, Row, Spinner } from 'react-bootstrap';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { useToast } from '../../context/ToastContext';
import { scenariosApi } from '../../api/services';
import { getErrorMessage } from '../../utils/helpers';
import useVoice from '../../hooks/useVoice';
import { matchResponse } from '../../utils/matchResponse';
import { deadAirLevel } from '../../utils/deliveryMetrics';
import KnowledgeBaseDrawer from '../../components/KnowledgeBaseDrawer';

const NOTICE_KEY = 'vla-voice-notice-seen';
const scoreTone = (s, max = 10) => (s / max >= 0.7 ? 'badge-green' : s / max >= 0.4 ? 'badge-amber' : 'badge-red');

export default function PlayScenario() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const voice = useVoice();

  // Load the scenario (briefing + first step). useFetch-style, inline so we can gate on id.
  const [scenario, setScenario] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let ignore = false;
    setLoading(true);
    scenariosApi
      .get(id)
      .then((res) => !ignore && setScenario(res.data))
      .catch((err) => !ignore && setLoadError(getErrorMessage(err)))
      .finally(() => !ignore && setLoading(false));
    return () => {
      ignore = true;
    };
  }, [id]);

  const [mode, setMode] = useState('text'); // 'text' | 'voice'
  const [phase, setPhase] = useState('briefing'); // 'briefing' | 'calling' | 'results'
  const [messages, setMessages] = useState([]);
  const [step, setStep] = useState(null);
  const [agentTurn, setAgentTurn] = useState(false);
  const [candidates, setCandidates] = useState(null); // { spoken, options } for "Did you mean?"
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [showNotice, setShowNotice] = useState(false);
  const [deadAirMs, setDeadAirMs] = useState(0);

  // Mutable refs for the live turn (don't need re-renders).
  const pathRef = useRef([]);
  const transcriptRef = useRef([]);
  const timingRef = useRef([]);
  const turnReadyRef = useRef(0);
  const listenStartRef = useRef(0);
  const silenceRef = useRef(0);
  const durationRef = useRef(0);
  const awaitingRef = useRef(false);
  const finalTextRef = useRef('');
  const stepRef = useRef(null);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);
  useEffect(() => {
    finalTextRef.current = voice.finalText;
  }, [voice.finalText]);

  const addMessage = (msg) => setMessages((m) => [...m, msg]);

  // Show a customer step: bubble + (voice) speak it, then open the agent's turn.
  const presentStep = useCallback(
    async (stepObj) => {
      setStep(stepObj);
      setCandidates(null);
      addMessage({ role: 'customer', text: stepObj.customerLine, stepKey: stepObj.key });
      if (mode === 'voice') {
        transcriptRef.current.push({ speaker: 'customer', text: stepObj.customerLine, stepKey: stepObj.key });
        await voice.speak(stepObj.customerLine, { mood: scenario?.customer?.mood });
      }
      turnReadyRef.current = Date.now();
      setDeadAirMs(0);
      setAgentTurn(true);
    },
    [mode, scenario, voice]
  );

  const startCall = async () => {
    pathRef.current = [];
    transcriptRef.current = [];
    timingRef.current = [];
    setMessages([]);
    setResult(null);
    setPhase('calling');
    await presentStep(scenario.firstStep);
  };

  const finish = async () => {
    setBusy(true);
    setAgentTurn(false);
    voice.cancel();
    try {
      const payload =
        mode === 'voice'
          ? { path: pathRef.current, mode: 'voice', transcript: transcriptRef.current, timing: timingRef.current }
          : pathRef.current;
      const res = await scenariosApi.submit(id, payload);
      setResult(res.data);
      setPhase('results');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  // Commit the agent's chosen option for the current step.
  const commitTurn = useCallback(
    async (optionIndex, spokenText) => {
      const stepObj = stepRef.current;
      if (!stepObj) return;
      setAgentTurn(false);
      setCandidates(null);
      setBusy(true);
      try {
        const res = await scenariosApi.respond(id, stepObj.key, optionIndex);
        const r = res.data;
        const optionText = stepObj.options[optionIndex]?.text || '';
        addMessage({ role: 'agent', text: mode === 'voice' ? spokenText || optionText : optionText, stepKey: stepObj.key, matched: optionText });
        addMessage({ role: 'feedback', score: r.score, maxScore: r.maxScore, feedback: r.feedback });
        pathRef.current.push({ stepKey: stepObj.key, optionIndex });
        if (mode === 'voice') {
          transcriptRef.current.push({ speaker: 'agent', text: spokenText || optionText, stepKey: stepObj.key });
          timingRef.current.push({ silenceBeforeMs: silenceRef.current || 0, durationMs: durationRef.current || 0 });
        }
        if (r.ended || !r.nextStep) await finish();
        else await presentStep(r.nextStep);
      } catch (err) {
        toast.error(getErrorMessage(err));
        setAgentTurn(true);
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, mode, presentStep]
  );

  // ----- Voice push-to-talk -----
  const onPushToTalk = () => {
    if (voice.listening) {
      voice.stopListening();
      return;
    }
    voice.reset();
    setCandidates(null);
    silenceRef.current = Math.max(0, Date.now() - turnReadyRef.current);
    listenStartRef.current = Date.now();
    awaitingRef.current = true;
    voice.startListening();
  };

  // When recognition ends, match the spoken text to an option.
  useEffect(() => {
    if (voice.listening || !awaitingRef.current) return undefined;
    awaitingRef.current = false;
    durationRef.current = Math.max(0, Date.now() - listenStartRef.current);
    const t = setTimeout(() => {
      const spoken = (finalTextRef.current || '').trim();
      const stepObj = stepRef.current;
      if (!spoken || !stepObj) {
        toast.error("Didn't catch that — tap the mic and try again.");
        setAgentTurn(true);
        return;
      }
      const res = matchResponse(spoken, stepObj.options);
      if (res.confident && res.best) {
        commitTurn(res.best.index, spoken);
      } else {
        const opts = res.candidates.length ? res.candidates : stepObj.options.map((o) => ({ index: o.index, text: o.text }));
        setCandidates({ spoken, options: opts });
        setAgentTurn(true);
      }
    }, 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.listening]);

  // Dead-air timer while waiting for the agent to start talking (voice).
  useEffect(() => {
    if (mode !== 'voice' || !agentTurn || voice.listening || candidates) return undefined;
    const iv = setInterval(() => setDeadAirMs(Date.now() - turnReadyRef.current), 200);
    return () => clearInterval(iv);
  }, [mode, agentTurn, voice.listening, candidates]);

  // Voice permission error -> fall back to text.
  useEffect(() => {
    if (voice.error === 'not-allowed') {
      toast.error('Microphone blocked. Switching to Text mode.');
      setMode('text');
    }
  }, [voice.error, toast]);

  const chooseVoice = () => {
    if (!voice.isSupported) return;
    if (localStorage.getItem(NOTICE_KEY) === 'true') {
      setMode('voice');
    } else {
      setShowNotice(true);
    }
  };
  const confirmNotice = () => {
    try {
      localStorage.setItem(NOTICE_KEY, 'true');
    } catch {
      /* ignore */
    }
    voice.cancel();
    voice.stopListening();
    setMode('voice');
    setShowNotice(false);
  };

  if (loading) return <LoadingSpinner />;
  if (loadError) {
    return (
      <EmptyState
        icon="bi-exclamation-triangle"
        title="Could not open this scenario"
        message={loadError}
        action={<Button as={Link} to="/agent/simulator">Back to simulator</Button>}
      />
    );
  }

  const level = deadAirLevel(deadAirMs);

  return (
    <>
      <PageHeader
        title={scenario.title}
        icon="bi-telephone-inbound"
        subtitle={`${scenario.category} · ${scenario.difficulty}`}
        actions={
          <Button variant="light" onClick={() => navigate('/agent/simulator')}>
            <i className="bi bi-x-lg me-1" /> End
          </Button>
        }
      />

      {/* BRIEFING */}
      {phase === 'briefing' && (
        <Card className="mx-auto" style={{ maxWidth: 640 }}>
          <Card.Body>
            <div className="d-flex align-items-center gap-3 mb-3">
              <div className="page-header-icon"><i className="bi bi-person-badge" /></div>
              <div>
                <div className="fw-semibold">{scenario.customer.name}</div>
                <div className="small text-muted">
                  Mood: <span className="text-capitalize">{scenario.customer.mood}</span> · Pass mark {scenario.passingScore}%
                </div>
              </div>
            </div>
            <p className="mb-3"><strong>Issue:</strong> {scenario.customer.issue}</p>
            {scenario.description && <p className="text-muted small">{scenario.description}</p>}

            {/* Mode toggle */}
            <div className="mb-3">
              <div className="small fw-semibold mb-1">Choose how you'll answer:</div>
              <div className="btn-group" role="group" aria-label="Answer mode">
                <Button variant={mode === 'text' ? 'primary' : 'outline-secondary'} onClick={() => setMode('text')}>
                  <i className="bi bi-keyboard me-1" /> Text
                </Button>
                <Button
                  variant={mode === 'voice' ? 'primary' : 'outline-secondary'}
                  onClick={chooseVoice}
                  disabled={!voice.isSupported}
                  title={voice.isSupported ? 'Answer by speaking' : 'Voice needs Chrome or Edge on desktop with a microphone'}
                >
                  <i className="bi bi-mic me-1" /> Voice
                </Button>
              </div>
              {!voice.isSupported && (
                <div className="small text-muted mt-1">
                  <i className="bi bi-info-circle me-1" />
                  Voice mode needs Chrome or Edge on desktop. You can still practice in Text mode.
                </div>
              )}
            </div>

            <Button size="lg" onClick={startCall}>
              <i className="bi bi-telephone-inbound me-2" /> Answer call
            </Button>
          </Card.Body>
        </Card>
      )}

      {/* CALL SCREEN */}
      {phase === 'calling' && (
        <Row className="justify-content-center">
          <Col lg={8}>
            <Card>
              <Card.Body>
                <div className="chat mb-3">
                  {messages.map((m, i) => {
                    if (m.role === 'feedback') {
                      return (
                        <div key={i} className="feedback-chip">
                          <span className={`badge-tone ${scoreTone(m.score, m.maxScore)}`}>+{m.score}/{m.maxScore}</span>
                          {m.feedback && <span className="small">{m.feedback}</span>}
                        </div>
                      );
                    }
                    return (
                      <div key={i} className={`bubble-row ${m.role}`}>
                        <div className={`bubble bubble-${m.role}`}>
                          {m.role === 'customer' && <div className="bubble-who">{scenario.customer.name}</div>}
                          {m.text}
                        </div>
                      </div>
                    );
                  })}

                  {/* Customer speaking indicator */}
                  {mode === 'voice' && voice.speaking && (
                    <div className="bubble-row customer">
                      <div className="bubble bubble-customer">
                        <span className="speaking-dots"><span /><span /><span /></span>
                      </div>
                    </div>
                  )}
                </div>

                {busy && <div className="text-center py-2"><Spinner size="sm" /></div>}

                {/* Agent input */}
                {agentTurn && !busy && (
                  <div className="answer-area">
                    {/* Did you mean? */}
                    {candidates ? (
                      <div>
                        <div className="small text-muted mb-2">
                          Heard: <em>“{candidates.spoken}”</em> — did you mean:
                        </div>
                        <div className="d-grid gap-2">
                          {candidates.options.map((o) => (
                            <Button key={o.index} variant="outline-secondary" className="text-start" onClick={() => commitTurn(o.index, candidates.spoken)}>
                              {o.text}
                            </Button>
                          ))}
                          <Button variant="link" size="sm" onClick={() => { setCandidates(null); turnReadyRef.current = Date.now(); }}>
                            <i className="bi bi-arrow-repeat me-1" /> Speak again
                          </Button>
                        </div>
                      </div>
                    ) : mode === 'voice' ? (
                      <div className="text-center">
                        {/* Dead-air timer */}
                        {!voice.listening && (
                          <div className={`deadair deadair-${level} mb-2`}>
                            <i className="bi bi-stopwatch me-1" />
                            {(deadAirMs / 1000).toFixed(1)}s
                            {level !== 'ok' && <span className="ms-1">dead air — respond now</span>}
                          </div>
                        )}
                        {voice.listening && <div className="interim mb-2">{voice.interimText || <span className="text-muted">Listening…</span>}</div>}
                        <Button className={`ptt ${voice.listening ? 'ptt-live' : ''}`} onClick={onPushToTalk} disabled={voice.speaking}>
                          <i className={`bi ${voice.listening ? 'bi-stop-circle' : 'bi-mic-fill'} me-2`} />
                          {voice.listening ? 'Stop' : 'Push to talk'}
                        </Button>
                        <div className="small text-muted mt-2">Tip: you can also say “option A”, “B”, or “C”.</div>
                      </div>
                    ) : (
                      // Text mode: clickable options
                      <div className="d-grid gap-2">
                        {step?.options.map((o) => (
                          <Button key={o.index} variant="outline-secondary" className="text-start" onClick={() => commitTurn(o.index)}>
                            {o.text}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* RESULTS */}
      {phase === 'results' && result && (
        <Results result={result} scenario={scenario} onRetry={() => setPhase('briefing')} />
      )}

      {/* First-time voice notice + mic check */}
      <Modal show={showNotice} onHide={() => setShowNotice(false)} centered>
        <Modal.Header closeButton>
          <div>
            <Modal.Title className="h5">Before you start voice mode</Modal.Title>
            <p className="modal-subtitle">A quick heads-up and a mic check.</p>
          </div>
        </Modal.Header>
        <Modal.Body>
          <ul className="small">
            <li>Your speech is processed by your browser's speech service.</li>
            <li>Only the <strong>text transcript</strong> is saved — never any audio.</li>
            <li>Use <strong>Chrome or Edge</strong> on desktop, ideally with a headset.</li>
          </ul>
          <hr />
          <div className="small fw-semibold mb-2">Mic check — tap and read this aloud:</div>
          <p className="fst-italic">“Thank you for calling Lumina Telecom, how may I help you today?”</p>
          <div className="d-flex align-items-center gap-2 mb-2">
            {!voice.listening ? (
              <Button size="sm" onClick={() => { voice.reset(); voice.startListening(); }} disabled={!voice.supports.stt}>
                <i className="bi bi-mic-fill me-1" /> Test mic
              </Button>
            ) : (
              <Button size="sm" variant="danger" onClick={voice.stopListening}>
                <i className="bi bi-stop-fill me-1" /> Stop
              </Button>
            )}
            {voice.listening && <Badge bg="danger">listening…</Badge>}
          </div>
          <div className="border rounded p-2 bg-white small" style={{ minHeight: 44 }}>
            <span>{voice.finalText}</span> <span className="text-muted fst-italic">{voice.interimText}</span>
            {!voice.finalText && !voice.interimText && <span className="text-muted">Your words will appear here…</span>}
          </div>
          {voice.error && <div className="small text-danger mt-1">Mic error: {voice.error}</div>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setShowNotice(false)}>Cancel</Button>
          <Button onClick={confirmNotice}><i className="bi bi-check-lg me-1" /> Use voice mode</Button>
        </Modal.Footer>
      </Modal>

      {/* Knowledge base is available mid-call (button or Ctrl+K) */}
      <KnowledgeBaseDrawer />
    </>
  );
}

// ---------- Results screen ----------
function Results({ result, scenario, onRetry }) {
  const isVoice = result.mode === 'voice';
  const d = result.delivery;
  return (
    <Row className="justify-content-center g-3">
      <Col lg={9}>
        <Card>
          <Card.Body className="text-center">
            <div className={`display-6 fw-bold ${result.passed ? 'text-success' : 'text-danger'}`}>
              {result.passed ? 'Passed' : 'Keep practicing'}
            </div>
            <div className="text-muted mb-3">Pass mark {result.passingScore}%</div>
            <Row className="g-3 justify-content-center">
              <Col xs={4} md={3}>
                <div className="score-tile">
                  <div className="score-num">{result.percentage}%</div>
                  <div className="score-lbl">Content</div>
                </div>
              </Col>
              {isVoice && (
                <Col xs={4} md={3}>
                  <div className="score-tile">
                    <div className="score-num">{d.deliveryScore}%</div>
                    <div className="score-lbl">Delivery</div>
                  </div>
                </Col>
              )}
              <Col xs={4} md={3}>
                <div className="score-tile score-tile-primary">
                  <div className="score-num">{result.combinedScore}%</div>
                  <div className="score-lbl">{isVoice ? 'Combined' : 'Score'}</div>
                </div>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      </Col>

      {/* Delivery metrics + tips (voice) */}
      {isVoice && d && (
        <Col lg={9}>
          <Card>
            <Card.Header>Delivery</Card.Header>
            <Card.Body>
              <Row className="g-3 text-center mb-3">
                <Col xs={6} md={3}><div className="metric"><div className="metric-num">{d.deadAirCount}</div><div className="metric-lbl">Dead air</div></div></Col>
                <Col xs={6} md={3}><div className="metric"><div className="metric-num">{d.fillerCount}</div><div className="metric-lbl">Fillers</div></div></Col>
                <Col xs={6} md={3}><div className="metric"><div className="metric-num">{d.wordsPerMinute}</div><div className="metric-lbl">WPM</div></div></Col>
                <Col xs={6} md={3}><div className="metric"><div className="metric-num">{Math.round(d.talkTimeMs / 1000)}s</div><div className="metric-lbl">Talk time</div></div></Col>
              </Row>
              {d.tips?.length > 0 && (
                <Alert variant="light" className="mb-0 border">
                  <div className="fw-semibold small mb-1"><i className="bi bi-lightbulb me-1" /> Coaching tips</div>
                  <ul className="small mb-0">
                    {d.tips.map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                </Alert>
              )}
            </Card.Body>
          </Card>
        </Col>
      )}

      {/* Transcript with per-turn feedback */}
      <Col lg={9}>
        <Card>
          <Card.Header>Call transcript</Card.Header>
          <Card.Body>
            {result.transcript.map((t, i) => (
              <div key={i} className="mb-3 pb-3 border-bottom">
                <div className="small text-muted">{scenario.customer.name}:</div>
                <div className="mb-2">{t.customerLine}</div>
                <div className="small text-muted">You:</div>
                <div className="mb-2">{t.response}</div>
                <div className="d-flex align-items-start gap-2">
                  <span className={`badge-tone ${scoreTone(t.score, 10)}`}>+{t.score}/10</span>
                  {t.feedback && <span className="small text-muted">{t.feedback}</span>}
                </div>
              </div>
            ))}
            <div className="d-flex gap-2">
              <Button onClick={onRetry}><i className="bi bi-arrow-repeat me-1" /> Try again</Button>
              <Button as={Link} to="/agent/simulator" variant="light">Back to simulator</Button>
            </div>
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
}
