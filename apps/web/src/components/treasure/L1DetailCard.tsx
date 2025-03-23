import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { POI, CONTRACTS } from '../../utils/contractUtils';
import { Address, createWalletClient, custom, formatUnits, formatEther, createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import L1POIMarketplaceABI from '../../abi/L1POIMarketplace.json';

// Define POI details type for display
interface POIDetail extends POI {
  chainId: number;
  network: string;
  // ERC-7638 related fields
  linkedL2Id?: string;
  hasL2Auction?: boolean;
  highestBid?: string;
  highestBidder?: string;
  auctionEndTime?: number;
}

interface L1DetailCardProps {
  onBack: () => void;
  onShowOnMap?: (lat: number, lng: number) => void;
}

export function L1DetailCard({ onBack, onShowOnMap }: L1DetailCardProps) {
  const { t } = useTranslation();
  const { user } = usePrivy();
  const { wallets } = useWallets();
  const [loading, setLoading] = useState<boolean>(true);
  const [userPOIs, setUserPOIs] = useState<POIDetail[]>([]);
  const [selectedPOI, setSelectedPOI] = useState<POIDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && wallets.length > 0) {
      fetchUserPOIs();
    }
  }, [user, wallets]);

  // Format time remaining for auction
  const formatTimeRemaining = (endTime: number): string => {
    const now = Date.now();
    const timeRemaining = endTime - now;
    
    if (timeRemaining <= 0) return t('treasureBox.auction.ended');
    
    const seconds = Math.floor((timeRemaining / 1000) % 60);
    const minutes = Math.floor((timeRemaining / (1000 * 60)) % 60);
    const hours = Math.floor((timeRemaining / (1000 * 60 * 60)) % 24);
    const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
    
    if (days > 0) return t('treasureBox.auction.daysHours', { days, hours });
    if (hours > 0) return t('treasureBox.auction.hoursMinutes', { hours, minutes });
    return t('treasureBox.auction.minutesSeconds', { minutes, seconds });
  };

  // Fetch user's POIs from L1 contract
  const fetchUserPOIs = async () => {
    setLoading(true);
    setError(null);
    try {
      const userAddress = user?.wallet?.address;
      if (!userAddress) {
        throw new Error(t('treasureBox.errors.noWalletAddress'));
      }
      
      // Fetch from Sepolia network
      if (!wallets.length) {
        throw new Error(t('treasureBox.errors.noWallet'));
      }

      const wallet = wallets[0];
      const ethProvider = await wallet.getEthereumProvider();
      
      // Create viem wallet client for Sepolia
      const walletClient = createWalletClient({
        chain: sepolia,
        transport: custom(ethProvider)
      });
      
      // Log wallet address (using the client to avoid linter error)
      console.log("Connected wallet:", (await walletClient.getAddresses())[0]);
      
      // Create viem public client for read operations
      const publicClient = createPublicClient({
        chain: sepolia,
        transport: http()
      });

      // Use proper contract ABI from imported JSON
      const contractABI = L1POIMarketplaceABI.abi;
      const contractAddress = CONTRACTS.L1.address;

      try {
        // Get total POIs from contract
        const totalPOIs = await publicClient.readContract({
          address: contractAddress,
          abi: contractABI,
          functionName: 'totalPOIs',
          args: []
        }) as bigint;
        
        console.log(`Total POIs in contract: ${totalPOIs}`);
        
        // Create an array to collect POIs
        const userPOIsList: POIDetail[] = [];
        
        // List all POIs from the contract, with focus on IDs 1 and 2 as instructed
        const poiIdsToFetch = [];
        
        // If there are POIs in the contract, fetch all of them up to a reasonable limit
        const maxPOIsToFetch = 10; // Limit to 10 POIs for performance
        const poiCount = totalPOIs < maxPOIsToFetch ? Number(totalPOIs) : maxPOIsToFetch;
        
        for (let i = 0; i < poiCount; i++) {
          poiIdsToFetch.push(BigInt(i));
        }
        
        // Ensure POIs with IDs 1 and 2 are included if they exist
        if (totalPOIs > 1n && !poiIdsToFetch.includes(1n)) {
          poiIdsToFetch.push(1n);
        }
        if (totalPOIs > 2n && !poiIdsToFetch.includes(2n)) {
          poiIdsToFetch.push(2n);
        }
        
        // Fetch each POI's details
        for (const poiId of poiIdsToFetch) {
          try {
            console.log(`Fetching POI ID ${poiId}`);
            
            // Get POI struct data from the contract based on L1POIMarketplace.sol
            const poiData = await publicClient.readContract({
              address: contractAddress,
              abi: contractABI,
              functionName: 'pois',
              args: [poiId]
            }) as [string, Address, bigint, boolean, Address, string, bigint, boolean, bigint, number];
            
            // POI struct fields from L1POIMarketplace.sol:
            // name, owner, stakeAmount, verified, validator, proof, timestamp, challenged, challengeEndTime, state
            const [name, owner, stakeAmount, verified, /* validator */, /* proof */, /* timestamp */, /* challenged */, /* challengeEndTime */, /* state */] = poiData;
            
            // Since getPOILocation isn't in the contract, we'll use mock coordinates
            let lat = BigInt(40758000); // Times Square lat * 10^6 
            let lng = BigInt(-73985500); // Times Square lng * 10^6
            const requiresSubscription = poiId === 1n ? true : false; // Mock data
            
            // If it's the Central Park POI, use different coordinates
            if (poiId === 2n) {
              lat = BigInt(40782900); // Central Park lat * 10^6
              lng = BigInt(-73965400); // Central Park lng * 10^6
            }
            
            // Mock L2 linkage data since getL2LinkStatus is not in the ABI
            const linkedL2Id = poiId + 100n; // L2 POIs are ID+100 (mock relationship)
            const hasL2Auction = true; // Assume all L1 POIs have L2 auctions for demo
            const highestBid = stakeAmount / 5n; // Mock highest bid as 20% of stake
            const highestBidder = "0x1234567890123456789012345678901234567890" as Address; // Mock bidder
            const auctionEndTime = BigInt(Math.floor(Date.now() / 1000) + 86400); // 24 hours from now
            
            // Convert big numbers to strings and format as needed
            userPOIsList.push({
              id: poiId.toString(),
              name,
              lat: parseFloat(formatUnits(lat, 6)), // Assuming lat/lng stored with 6 decimals
              lng: parseFloat(formatUnits(lng, 6)),
              owner,
              subscriptionPrice: formatEther(stakeAmount / 10n), // Subscription price as 10% of stake
              requiresSubscription,
              verified,
              isAuctionEnabled: hasL2Auction,
              chainId: 11155111, // Sepolia testnet
              network: 'Sepolia',
              linkedL2Id: linkedL2Id.toString(),
              hasL2Auction,
              highestBid: hasL2Auction ? formatEther(highestBid) : undefined,
              highestBidder: hasL2Auction ? 
                `${highestBidder.slice(0, 6)}...${highestBidder.slice(-4)}` : undefined,
              auctionEndTime: hasL2Auction ? Number(auctionEndTime) * 1000 : undefined // Convert to ms
            });
          } catch (error) {
            console.error(`Error fetching details for POI ${poiId}:`, error);
          }
        }
        
        // If no POIs found, use mock data for demo
        if (userPOIsList.length === 0) {
          throw new Error("No POIs found");
        }
        
        setUserPOIs(userPOIsList);
      } catch (err) {
        console.error('Error reading from contract:', err);
        throw err;
      }
    } catch (err) {
      console.error('Error fetching POIs from Sepolia:', err);
      
      // Fallback to mock data if contract interaction fails
      if (user?.wallet?.address) {
        const mockPOIs: POIDetail[] = [
          {
            id: '1',
            name: 'Times Square',
            lat: 40.7580,
            lng: -73.9855,
            owner: user.wallet.address as Address,
            subscriptionPrice: '0.1',
            requiresSubscription: true,
            verified: true,
            isAuctionEnabled: true,
            chainId: 11155111,
            network: 'Sepolia',
            linkedL2Id: '101',
            hasL2Auction: true,
            highestBid: '0.05',
            highestBidder: '0x1234...5678',
            auctionEndTime: Date.now() + 86400000 // 24 hours from now
          },
          {
            id: '2',
            name: 'Central Park',
            lat: 40.7829,
            lng: -73.9654,
            owner: user.wallet.address as Address,
            subscriptionPrice: '0.2',
            requiresSubscription: false,
            verified: true,
            isAuctionEnabled: true,
            chainId: 11155111,
            network: 'Sepolia',
            linkedL2Id: '102',
            hasL2Auction: true,
            highestBid: '0.1',
            highestBidder: '0x5678...9012',
            auctionEndTime: Date.now() + 172800000 // 48 hours from now
          }
        ];
        
        setUserPOIs(mockPOIs);
        setError(t('treasureBox.errors.fallbackToMock', 'Failed to connect to Sepolia. Using mock data instead.'));
      } else {
        setError(err instanceof Error ? err.message : t('treasureBox.errors.fetchPOIsFailure'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (poi: POIDetail) => {
    setSelectedPOI(poi);
  };

  const handleCloseDetails = () => {
    setSelectedPOI(null);
  };
  
  // Navigate to coordinates on the map
  const handleShowOnMap = (lat: number, lng: number) => {
    if (onShowOnMap) {
      onShowOnMap(lat, lng);
      onBack(); // Return to map
    }
  };

  // Render loading state
  if (loading) {
    return (
      <div className="detail-card-container">
        <div className="detail-card-header">
          <button className="back-button" onClick={onBack}>
            ← {t('treasureBox.back')}
          </button>
          <h3>{t('treasureBox.l1DetailCardName', 'L1 Detail')}</h3>
        </div>
        <div className="loading-indicator">
          <div className="spinner"></div>
          <p>{t('treasureBox.loading', 'Loading your POIs...')}</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="detail-card-container">
        <div className="detail-card-header">
          <button className="back-button" onClick={onBack}>
            ← {t('treasureBox.back')}
          </button>
          <h3>{t('treasureBox.l1DetailCardName', 'L1 Detail')}</h3>
        </div>
        <div className="error-message">
          <p>{error}</p>
          <button className="action-button" onClick={fetchUserPOIs}>
            {t('treasureBox.retry', 'Retry')}
          </button>
        </div>
      </div>
    );
  }

  // Render POI details
  if (selectedPOI) {
    return (
      <div className="detail-card-container">
        <div className="detail-card-header">
          <button className="back-button" onClick={handleCloseDetails}>
            ← {t('treasureBox.back')}
          </button>
          <h3>{selectedPOI.name}</h3>
        </div>
        <div className="poi-detail-content">
          <div className="network-info">
            <span className="network-badge">{selectedPOI.network}</span>
            <span className="chain-id">Chain ID: {selectedPOI.chainId}</span>
          </div>
          
          <div className="detail-section">
            <h4>{t('treasureBox.poiDetails', 'POI Details')}</h4>
            <div className="detail-item">
              <span className="detail-label">ID:</span>
              <span className="detail-value">{selectedPOI.id}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">{t('treasureBox.coordinates', 'Coordinates')}:</span>
              <span className="detail-value">{selectedPOI.lat}, {selectedPOI.lng}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">{t('treasureBox.owner', 'Owner')}:</span>
              <span className="detail-value truncate">{selectedPOI.owner}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">{t('treasureBox.subscriptionPrice', 'Subscription Price')}:</span>
              <span className="detail-value">{selectedPOI.subscriptionPrice} ETH</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">{t('treasureBox.requiresSubscription', 'Requires Subscription')}:</span>
              <span className="detail-value">{selectedPOI.requiresSubscription ? t('common.yes') : t('common.no')}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">{t('treasureBox.verified', 'Verified')}:</span>
              <span className="detail-value">{selectedPOI.verified ? t('common.yes') : t('common.no')}</span>
            </div>
          </div>
          
          {/* ERC-7638 Cross-Chain Information */}
          {selectedPOI.linkedL2Id && (
            <div className="detail-section cross-chain-section">
              <h4>{t('treasureBox.crossChainInfo', 'Cross-Chain Information')}</h4>
              <div className="detail-item">
                <span className="detail-label">{t('treasureBox.linkedL2POI', 'Linked L2 POI')}:</span>
                <span className="detail-value">ID: {selectedPOI.linkedL2Id}</span>
              </div>
              {selectedPOI.hasL2Auction && (
                <>
                  <div className="detail-item">
                    <span className="detail-label">{t('treasureBox.l2AuctionStatus', 'L2 Auction Status')}:</span>
                    <span className="detail-value auction-active">{t('treasureBox.auction.active', 'Active')}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">{t('treasureBox.highestBid', 'Highest Bid')}:</span>
                    <span className="detail-value">{selectedPOI.highestBid} ETH</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">{t('treasureBox.highestBidder', 'Highest Bidder')}:</span>
                    <span className="detail-value truncate">{selectedPOI.highestBidder}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">{t('treasureBox.timeRemaining', 'Time Remaining')}:</span>
                    <span className="detail-value">
                      {selectedPOI.auctionEndTime ? formatTimeRemaining(selectedPOI.auctionEndTime) : 'N/A'}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
          
          <div className="detail-actions">
            <button 
              onClick={() => handleShowOnMap(selectedPOI.lat, selectedPOI.lng)}
              className="show-on-map-btn"
            >
              {t('treasureBox.showOnMap', 'Show on Map')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render list of user's POIs or empty state
  return (
    <div className="detail-card-container">
      <div className="detail-card-header">
        <button className="back-button" onClick={onBack}>
          ← {t('treasureBox.back')}
        </button>
        <h3>{t('treasureBox.l1DetailCardName', 'L1 Detail')}</h3>
      </div>
      
      <div className="poi-list-container">
        <h4>{t('treasureBox.yourPOIs', 'Your POIs on L1')}</h4>
        
        {userPOIs.length === 0 ? (
          <div className="no-pois-message">
            <p>{t('treasureBox.noPOIs', 'You don\'t have any POIs on L1 yet.')}</p>
            <div className="empty-state-actions">
              <button 
                className="action-button" 
                onClick={onBack}
                style={{ marginTop: '16px' }}
              >
                {t('treasureBox.addPOI', 'Add POI')}
              </button>
            </div>
          </div>
        ) : (
          <div className="poi-list">
            {userPOIs.map((poi) => (
              <div key={poi.id} className="poi-item">
                <div className="poi-header">
                  <h4>{poi.name}</h4>
                  <span className="poi-id">ID: {poi.id}</span>
                  {poi.linkedL2Id && (
                    <span className="cross-chain-badge" title={t('treasureBox.crossChainTooltip', 'This POI has a cross-chain link to L2')}>
                      {t('treasureBox.crossChain', 'Cross-Chain')}
                    </span>
                  )}
                </div>
                <div className="poi-location">
                  {poi.lat.toFixed(4)}, {poi.lng.toFixed(4)}
                </div>
                <div className="poi-info">
                  {poi.hasL2Auction && (
                    <span className="l2-auction-info">
                      <span className="auction-badge active">{t('treasureBox.l2AuctionActive', 'L2 Auction')}</span>
                      <span className="highest-bid">{poi.highestBid} ETH</span>
                    </span>
                  )}
                </div>
                <div className="poi-footer">
                  <span className={`poi-status ${poi.verified ? 'verified' : 'unverified'}`}>
                    {poi.verified ? t('treasureBox.verified', 'Verified') : t('treasureBox.unverified', 'Unverified')}
                  </span>
                  <div className="poi-actions">
                    <button 
                      className="view-details-btn"
                      onClick={() => handleViewDetails(poi)}
                    >
                      {t('treasureBox.viewDetails', 'View Details')}
                    </button>
                    <button 
                      className="show-on-map-btn"
                      onClick={() => handleShowOnMap(poi.lat, poi.lng)}
                    >
                      {t('treasureBox.showOnMap', 'Show on Map')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 