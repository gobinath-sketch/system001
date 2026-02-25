/* 
  Custom 3D Toggle Switch 
  Adapted from user-provided styled-components logic to work with pure CSS/Tailwind
*/
const RealisticToggle = ({
  checked,
  onChange
}) => {
  return <div className="realistic-toggle-wrapper">
            <div className="container">
                <input type="checkbox" name="currency-checkbox" id="currency-checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
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
            height: 20px; /* Reduced from 25px */
            width: 40px;  /* Reduced from 50px */
            background-color: #ffffff;
            border: 1px solid rgba(0, 0, 0, 0.2);
            border-radius: 5px;
            box-shadow: 
                inset 0 0 5px 4px rgba(255, 255, 255, 1),
                inset 0 0 10px 1px rgba(0, 0, 0, 0.488), 
                5px 10px 15px rgba(0, 0, 0, 0.096),
                inset 0 0 0 3px rgba(0, 0, 0, 0.3);
            display: flex;
            align-items: center;
            cursor: pointer;
            position: relative;
            overflow: hidden;
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
            font-family: "Segoe UI Symbol", "Segoe UI", sans-serif;
            font-weight: 700;
            color: #1f1f1f;
            font-size: 12px;
            line-height: 1;
            
            height: 16px; /* Reduced from 19px */
            width: 16px;  /* Reduced from 19px */
            border-radius: 3px;
            border: 1px solid rgba(0, 0, 0, 0.25);
            background-color: #bfbfbf;
            background-image: linear-gradient(145deg, #f4f4f4 0%, #d8d8d8 55%, #bdbdbd 100%);
            left: 2px; /* Adjust for padding */
            box-shadow: 0 2px 1px rgba(0, 0, 0, 0.25), 5px 5px 5px rgba(0, 0, 0, 0.2);
            transition: left 0.4s ease, background-image 0.2s ease, color 0.2s ease;
        }

        /* Checked State (Knob Move) */
        .realistic-toggle-wrapper #currency-checkbox:checked ~ .label::before {
            left: 22px; /* Calculated: width(40) - knob(16) - padding(2) = 22 */
            content: "$"; /* Checked = USD */
            color: #fff;
            background-color: #000000;
            background-image: linear-gradient(315deg, #000000 0%, #414141 70%);
        }
      `}</style>
        </div>;
};
export default RealisticToggle;
