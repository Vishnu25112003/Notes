import styled from 'styled-components';

const PowerIcon = ({ size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 3v9" />
    <path d="M17.66 6.34a8 8 0 1 1-11.31 0" />
  </svg>
);

// Neumorphic power toggle button: green glowing bezel when on, neutral
// bezel when off. The face uses the app's CSS theme variables, so it
// follows dark/light mode automatically.
const PowerButton = ({ on = false, onClick, title, size = 38 }) => (
  <StyledButton type="button" onClick={onClick} title={title} aria-pressed={on} $on={on} $size={size}>
    <span className="face">
      <PowerIcon size={Math.round(size * 0.5)} />
    </span>
  </StyledButton>
);

const StyledButton = styled.button`
  width: ${(p) => p.$size}px;
  height: ${(p) => p.$size}px;
  padding: 3px;
  border: none;
  cursor: pointer;
  border-radius: ${(p) => Math.round(p.$size * 0.32)}px;
  background: ${(p) =>
    p.$on
      ? 'linear-gradient(145deg, #43d16b, #1d9e40)'
      : 'linear-gradient(145deg, var(--border), var(--border-faint))'};
  box-shadow: ${(p) =>
    p.$on
      ? '0 2px 8px rgba(47, 191, 79, 0.55), 0 0 14px rgba(47, 191, 79, 0.35)'
      : '0 2px 6px rgba(0, 0, 0, 0.35)'};
  transition: background 0.2s, box-shadow 0.2s, transform 0.1s;

  .face {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    border-radius: ${(p) => Math.round(p.$size * 0.26)}px;
    background: var(--bg);
    box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.08), inset 0 -2px 4px rgba(0, 0, 0, 0.25);
    color: ${(p) => (p.$on ? '#2fbf4f' : 'var(--text-mid)')};
    transition: color 0.2s;
  }

  &:active {
    transform: scale(0.93);
  }
`;

export default PowerButton;
