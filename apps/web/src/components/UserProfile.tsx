import { useState } from 'react';
import { useAuth } from '../providers/AuthContext';
import { EMOJI_OPTIONS } from '../providers/PrivyProvider';

export function UserProfile() {
  const { user, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);

  // Get user's display name or email
  const displayName = user?.email?.address || 
    (user?.wallet?.address ? 
      `${user.wallet.address.substring(0, 6)}...${user.wallet.address.substring(user.wallet.address.length - 4)}` :
      'Anonymous User');

  // Use the first emoji as a fallback
  const defaultEmoji = EMOJI_OPTIONS[Math.floor(Math.random() * EMOJI_OPTIONS.length)];

  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
  };

  return (
    <div className="user-profile-container">
      <div className="profile-button" onClick={toggleDropdown}>
        <div className="user-emoji-avatar">{defaultEmoji}</div>
        <span className="user-name">{displayName}</span>
      </div>

      {showDropdown && (
        <div className="profile-dropdown">
          <div className="dropdown-header">
            <div className="dropdown-emoji-avatar">{defaultEmoji}</div>
            <div className="dropdown-user-info">
              <span className="dropdown-user-name">{displayName}</span>
              {user?.wallet?.address && (
                <span className="dropdown-wallet-address">
                  {user.wallet.address.substring(0, 6)}...{user.wallet.address.substring(user.wallet.address.length - 4)}
                </span>
              )}
            </div>
          </div>
          
          <div className="dropdown-menu">
            <button className="dropdown-item">
              <span className="item-icon">👤</span>
              My Profile
            </button>
            <button className="dropdown-item">
              <span className="item-icon">🏆</span>
              My Rewards
            </button>
            <button className="dropdown-item">
              <span className="item-icon">⚙️</span>
              Settings
            </button>
            <button className="dropdown-item logout" onClick={logout}>
              <span className="item-icon">🚪</span>
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 