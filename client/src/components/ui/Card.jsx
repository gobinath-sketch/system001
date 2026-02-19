import PropTypes from 'prop-types';
const Card = ({
  children,
  className = '',
  variant = 'default',
  hover = false
}) => {
  // Glassmorphism Base Style
  const glassStyle = {
    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0))',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    borderRadius: '30px',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37), inset 0 0 30px rgba(255, 255, 255, 0.3), inset 0 0 10px rgba(255, 255, 255, 0.5)',
    borderTop: '1px solid rgba(255, 255, 255, 0.8)',
    borderLeft: '1px solid rgba(255, 255, 255, 0.8)',
    overflow: 'hidden',
    position: 'relative'
  };
  const baseClasses = 'p-6 transition-shadow';

  // We can keep specific variant differences (like border colors for alerts) 
  // but we might want them to be subtle overlays or text colors to not break the glass look.
  // For now, let's keep the variants as additional classes that might override border/bg somewhat,
  // but the inline style will take precedence for the main background.
  // Actually, to ensure consistency, let's rely on the glass style for the container 
  // and use variants mainly for content/border adjustments if absolutely needed.
  // The user said "wherever container comes I need this look".

  // Removing variant-specific overly-strong backgrounds to keep uniformity
  const variantClasses = {
    default: '',
    highlighted: 'border-primary-blue',
    // Just add a blue border hint
    warning: 'border-accent-yellow-dark',
    danger: 'border-alert-danger'
  };
  const hoverClass = hover ? 'hover:shadow-[0_8px_32px_0_rgba(255,255,255,0.3)] cursor-pointer transform hover:scale-[1.01] transition-all duration-300' : '';
  return <div className={`${baseClasses} ${variantClasses[variant]} ${hoverClass} ${className}`} style={glassStyle}>
            {/* Shine Effect Overlay */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0" style={{
      background: 'linear-gradient(45deg, transparent 40%, rgba(255, 255, 255, 0.3) 50%, transparent 60%)',
      transform: 'translateX(-100%)',
      animation: 'shine 6s infinite' // Slower animation for general cards to be less distracting
    }} />

            {/* Content needs relative positioning to be above the shine */}
            <div className="relative z-10">
                {children}
            </div>
        </div>;
};
Card.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  variant: PropTypes.oneOf(['default', 'highlighted', 'warning', 'danger']),
  hover: PropTypes.bool
};
export default Card;