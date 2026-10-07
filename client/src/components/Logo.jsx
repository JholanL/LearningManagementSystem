import { Link } from 'react-router-dom';

export default function Logo({ light = false, to = '/' }) {
  return (
    <Link to={to} className={`lms-logo font-display ${light ? 'lms-logo--light' : ''}`}>
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke={light ? '#8fd6ae' : '#17694a'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15" />
        <path d="M5 19c3-5 6-8 10-10" />
      </svg>
      Luntian
    </Link>
  );
}
