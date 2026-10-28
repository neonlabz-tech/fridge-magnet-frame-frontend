'use client';

import React from 'react';
import { useCustomers } from '@/hooks/useCustomers';

type TopCardsProps = {
  onAddCustomer?: () => void;
};

const TopCards = ({ onAddCustomer }: TopCardsProps) => {
  const { stats } = useCustomers();
  const satisfactionRate =
    `${stats.satisfactionRate.toFixed(1)}%`;

  return (
    <>
      <div className="cardsContainer">
        <div className="card statsCard">
          <div className="statGroup">
            <span className="statTitle">Total Active Customers</span>
            <span className="statValue">
              {stats.totalActiveCustomers.toLocaleString()}
            </span>
          </div>

          <div className="statDivider"></div>

          <div className="statGroup">
            <span className="statTitle">Satisfaction Rate</span>
            <span className="statValue">{satisfactionRate}</span>
          </div>

          <div className="chartPlaceholder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
          </div>
        </div>

        <div className="card priorityCard">
          <div style={{ zIndex: 1 }}>
            <div className="priorityTitle">Priority Support</div>
            <div className="priorityValue">Dedicated Desk</div>

            <button type="button" className="connectBtn" onClick={onAddCustomer}>
              + Add Customer
            </button>
          </div>

          <svg className="supportIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a10 10 0 0 0-10 10c0 5.52 4.48 10 10 10s10-4.48 10-10A10 10 0 0 0 12 2z"></path>
            <path d="M12 12v10"></path>
            <path d="M12 12h10"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        </div>
      </div>

      <style jsx>{`
        .cardsContainer {
          display: flex;
          gap: 16px;
          margin-bottom: 18px;
        }

        .card {
          background-color: #ffffff;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          padding: 16px 20px;
          flex: 1;
          box-shadow: 0 3px 10px rgba(15, 23, 42, 0.04);
        }

        .statsCard {
          background-color: #eff6ff;
          border: 1px solid #dbeafe;
          border-radius: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .statGroup {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .statTitle {
          color: var(--text-light);
          font-size: 14px;
          font-weight: 500;
        }

        .statValue {
          font-size: 18px;
          font-weight: 600;
          color: var(--color-primary-dark);
        }

        .statDivider {
          width: 1px;
          height: 40px;
          background-color: var(--border-color);
          margin: 0 18px;
        }

        .chartPlaceholder {
          width: 44px;
          height: 40px;
          background: rgba(255, 255, 255, 0.7);
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .chartPlaceholder svg {
          color: var(--color-primary);
          width: 24px;
          height: 24px;
        }

        .priorityCard {
          background: linear-gradient(135deg, #0f2c69 0%, #174092 100%);
          color: white;
          border: none;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .priorityTitle {
          font-size: 14px;
          font-weight: 500;
          opacity: 0.9;
          margin-bottom: 4px;
        }

        .priorityValue {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 10px;
        }

        .connectBtn {
          background-color: white;
          color: blue;
          padding: 6px 14px;
          border-radius: 20px;
          font-weight: 600;
          font-size: 14px;
          width: fit-content;
          border: none;
          cursor: pointer;
          transition: transform 0.2s;
        }

        .connectBtn:hover {
          transform: translateY(-1px);
        }

        .supportIcon {
          position: absolute;
          right: -10px;
          bottom: -20px;
          width: 120px;
          height: 120px;
          opacity: 0.1;
          color: white;
        }

        @media (max-width: 768px) {
          .cardsContainer {
            flex-direction: column;
          }
        }
      `}</style>
    </>
  );
};

export default TopCards;
