import { Form, InputGroup } from 'react-bootstrap';

export default function SearchBar({ value, onChange, placeholder = 'Search...' }) {
  return (
    <InputGroup className="search-bar">
      <InputGroup.Text>
        <i className="bi bi-search" />
      </InputGroup.Text>
      <Form.Control
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        maxLength={100}
      />
    </InputGroup>
  );
}
