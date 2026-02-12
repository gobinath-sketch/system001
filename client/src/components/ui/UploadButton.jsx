import React from 'react';
import styled from 'styled-components';

const UploadButton = ({ onClick, disabled, className, type = "button", children, variant = "primary" }) => {
  return (
    <StyledWrapper className={className} $variant={variant}>
      <button
        className="button"
        onClick={onClick}
        disabled={disabled}
        type={type}
      >
        <svg id="UploadToCloud" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" height="12px" width="12px" className="icon">
          <path d="M0 0h24v24H0V0z" fill="none" />
          <path className="color000000 svgShape" fill="#000000" d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l4.65-4.65c.2-.2.51-.2.71 0L17 13h-3z" />
        </svg>
        {children || 'Upload'}
      </button>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  display: inline-block;

  .button {
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    background: ${props => props.$variant === 'primary' ? 'linear-gradient(45deg, #0056b3, #003D7A)' : 'linear-gradient(45deg, #ffc75d, #ffc708)'};
    box-shadow: ${props => props.$variant === 'primary' ? '0 0 6px rgba(0, 61, 122, 0.3)' : '0 0 6px #ffb20840'};
    border: 1.5px solid ${props => props.$variant === 'primary' ? '#003D7A' : '#ffe825'};
    border-radius: 100px;
    transition: background-color 0.3s ease, box-shadow 0.3s ease,
      text-shadow 0.3s ease;
    padding: 3px 8px;
    color: ${props => props.$variant === 'primary' ? '#ffffff' : '#09090b'};
    font-weight: bold;
    font-size: 10px;
    text-shadow: ${props => props.$variant === 'primary' ? 'none' : '1px 1px 2px rgba(0, 0, 0, 0.2)'};
  }

  .button:hover {
    background: ${props => props.$variant === 'primary' ? 'linear-gradient(45deg, #004494, #002a5e)' : '#ffc75d'} !important;
    box-shadow: ${props => props.$variant === 'primary' ? '0 0 10px rgba(0, 61, 122, 0.5)' : '0 0 10px #ffb20861'} !important;
    text-shadow: ${props => props.$variant === 'primary' ? 'none' : '0 0 2px #ffe825'};
    border-color: ${props => props.$variant === 'primary' ? '#002a5e' : '#ffe825'} !important;
  }

  .button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background: #ccc;
    box-shadow: none;
    border-color: #999;
    color: #666;
  }

  .icon {
    margin-right: 4px;
    filter: drop-shadow(1px 1px 2px rgba(0, 0, 0, 0.2));
  }
  
  .icon path.color000000 {
     fill: ${props => props.$variant === 'primary' ? '#ffffff' : '#000000'};
  }
`;

export default UploadButton;
