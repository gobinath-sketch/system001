
import React from 'react';

/* 
  Custom 3D Toggle Switch 
  Adapted from user-provided styled-components logic to work with pure CSS/Tailwind
*/
const RealisticToggle = ({ checked, onChange }) => {
    return (
        <div className="realistic-toggle-wrapper">
            <div className="container">
                <input
                    type="checkbox"
                    name="currency-checkbox"
                    id="currency-checkbox"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                />
                <label htmlFor="currency-checkbox" className="label">
                    {/* The pseudo-elements handle the visual knob */}
                </label>
            </div>

            <style>{`
        .realistic-toggle-wrapper .container {
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .realistic-toggle-wrapper .label {
            height: 25px; /* Reduced from 30px */
            width: 50px;  /* Reduced from 60px */
            background-color: #ffffff;
            border-radius: 12.5px; /* Reduced from 15px */
            box-shadow: 
                inset 0 0 5px 4px rgba(255, 255, 255, 1),
                inset 0 0 10px 1px rgba(0, 0, 0, 0.488), 
                5px 10px 15px rgba(0, 0, 0, 0.096),
                inset 0 0 0 3px rgba(0, 0, 0, 0.3);
            display: flex;
            align-items: center;
            cursor: pointer;
            position: relative;
            transition: transform 0.4s;
        }

        .realistic-toggle-wrapper .label:hover {
            transform: perspective(100px) rotateX(5deg) rotateY(-5deg);
        }

        .realistic-toggle-wrapper #currency-checkbox:checked ~ .label:hover {
            transform: perspective(100px) rotateX(-5deg) rotateY(5deg);
        }

        .realistic-toggle-wrapper #currency-checkbox {
            display: none;
        }

        /* Knob (Before) */
        .realistic-toggle-wrapper .label::before {
            position: absolute;
            content: "₹"; /* Default Unchecked = INR */
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            color: #140707ef;
            font-size: 11px; /* Reduced from 12px */
            
            height: 19px; /* Reduced from 22px */
            width: 19px;  /* Reduced from 22px */
            border-radius: 50%;
            background-color: #000000;
            background-image: linear-gradient(
                130deg,
                #757272 10%,
                #ffffff 11%,
                #726f6f 62%
            );
            left: 3px; /* Adjust for padding */
            box-shadow: 0 2px 1px rgba(0, 0, 0, 0.3), 5px 5px 5px rgba(0, 0, 0, 0.3);
            transition: 0.4s;
        }

        /* Checked State (Knob Move) */
        .realistic-toggle-wrapper #currency-checkbox:checked ~ .label::before {
            left: 28px; /* Calculated: width(50) - knob(19) - padding(3) = 28 */
            content: "$"; /* Checked = USD */
            color: #fff;
            background-color: #000000;
            background-image: linear-gradient(315deg, #000000 0%, #414141 70%);
        }
      `}</style>
        </div >
    );
};

export default RealisticToggle;
