import React, { useState, useCallback } from "react";
import { makeStyles } from "@material-ui/core";
import Map from "../Map/Map";
import Sidebar from "../Sidebar/Sidebar";
import CoverHero from "../Cover/CoverHero";
import CoverFooter from "../Cover/CoverFooter";
import CoverHeader from "../Cover/CoverHeader";
import CoverLegend from "../Cover/CoverLegend";
import Header from "../Header/Header";
import { useAppState } from "../../state";
import { ChatPanel } from "../Chat";
import { useSlideAwareAITools } from "../../hooks/useSlideAwareAITools";
import slidesConfigForAI from "../../slidesConfigForAI";

const WS_URL = "ws://localhost:3000/ws";
const DEMO_ID = "sdsc-2025-congestion";

const useStyles = makeStyles((theme) => ({
  "@global": {
    body: {
      overflowX: "hidden",
    },
  },
  root: {
    display: "flex",
    position: "absolute",
    left: 0,
    top: 0,
    width: "100%",
    height: "100%",
  },
  rootCover: {
    minHeight: theme.spacing(58),

    [theme.breakpoints.up("md")]: {
      minHeight: theme.spacing(66),
    },
  },
}));

const Main = () => {
  const classes = useStyles();
  const appState = useAppState();
  const { currentSlide } = appState;
  const [chatOpen, setChatOpen] = useState(false);

  // Memoize callbacks to prevent re-renders
  const handleToggleChat = useCallback(() => setChatOpen(prev => !prev), []);
  const handleCloseChat = useCallback(() => setChatOpen(false), []);

  // Initialize AI tools with slide awareness
  const {
    messages,
    isConnected,
    loaderState,
    sendMessage,
  } = useSlideAwareAITools({
    wsUrl: WS_URL,
    demoId: DEMO_ID,
    appState,
    slidesConfig: slidesConfigForAI,
  });

  return (
    <div
      className={[
        classes.root,
        currentSlide === 0 ? classes.rootCover : "",
      ].join(" ")}
    >
      <Map />
      <CoverHeader />
      <CoverHero />
      <CoverFooter />
      <CoverLegend />
      <Sidebar chatOpen={chatOpen} onToggleChat={handleToggleChat} />
      <Header
        hidden={currentSlide > 0}
        hideDelay={500}
        showDelay={0}
        chatOpen={chatOpen}
        onToggleChat={handleToggleChat}
      />

      {/* AI Chat Panel */}
      <ChatPanel
        open={chatOpen}
        onClose={handleCloseChat}
        messages={messages}
        onSendMessage={sendMessage}
        loaderState={loaderState}
        isConnected={isConnected}
        sidebarOpen={currentSlide > 0}
      />
    </div>
  );
};

export default Main;
