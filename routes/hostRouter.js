import express from "express";
import {hostController} from '../controllers/hostController.js';

const hostRouter = express.Router();

hostRouter.get('/addHome',hostController.getaddHome); 
hostRouter.post('/addHome', hostController.postaddHome);

hostRouter.get('/hostHomeList',hostController.hostHomeList);

hostRouter.get('/editHome/:homeId',hostController.getEditHome);
hostRouter.post('/editHome/:homeId', hostController.postEditHome);

hostRouter.post('/deleteHome/:homeId',hostController.postDeleteHome);

hostRouter.get("/manage-dates/:homeId",hostController.getManageDates);

hostRouter.post("/block-dates", hostController.postBlockDates);
hostRouter.post("/unblock-dates/:homeId/:blockId", hostController.postUnblockDate);

hostRouter.get('/dashboard', hostController.getDashboard);

hostRouter.post('/payout-details', hostController.postPayoutDetails);
hostRouter.get('/payouts/export', hostController.exportPayoutsStatement);

hostRouter.get('/calendar/:homeId/:token.ics', hostController.getIcsExport);
hostRouter.post('/add-calendar',    hostController.postAddExternalCalendar);
hostRouter.post('/remove-calendar/:homeId/:calId', hostController.postRemoveExternalCalendar);
hostRouter.post('/sync-calendars/:homeId',         hostController.postSyncExternalCalendars);

hostRouter.post('/add-pricing',     hostController.postAddSeasonalPricing);
hostRouter.post('/remove-pricing/:homeId/:ruleId', hostController.postRemoveSeasonalPricing);

hostRouter.get('/analytics/:homeId', hostController.getHomeAnalytics);

export { hostRouter};


 