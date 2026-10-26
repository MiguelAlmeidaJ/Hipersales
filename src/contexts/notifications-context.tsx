import Constants from "expo-constants";
import * as Device from "expo-device";
import { router, type Href } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { Platform } from "react-native";

import { setBeforeLogoutHandler, useSession } from "@/contexts/session-context";
import { api } from "@/lib/api";

type PermissionState = "checking" | "granted" | "denied" | "unavailable";
type NotificationsContextValue = { unreadCount:number; permission:PermissionState; enable:()=>Promise<boolean>; refresh:()=>Promise<void>; markRead:(id:number)=>Promise<void>; markAllRead:()=>Promise<void> };
const NotificationsContext=createContext<NotificationsContextValue|null>(null);
const allowedRoutes=new Set(["/(app)/orders","/(app)/customers","/approvals","/occurrences","/goals","/(app)/modules"]);
const nativePushAvailable=Platform.OS!=="web"&&Constants.appOwnership!=="expo";
type NotificationsModule=typeof import("expo-notifications");
let notificationsPromise:Promise<NotificationsModule>|null=null;

async function getNotifications(){
  if(!nativePushAvailable)return null;
  notificationsPromise??=import("expo-notifications").then(module=>{module.setNotificationHandler({handleNotification:async()=>({shouldShowBanner:true,shouldShowList:true,shouldPlaySound:true,shouldSetBadge:true})});return module;});
  return notificationsPromise;
}

function projectId(){const extra=Constants.expoConfig?.extra as {eas?:{projectId?:string}}|undefined;return Constants.easConfig?.projectId??extra?.eas?.projectId;}
function openNotification(data:Record<string,unknown>|undefined){const route=typeof data?.route==="string"?data.route:"";if(allowedRoutes.has(route))router.push(route as Href);}

export function NotificationsProvider({children}:PropsWithChildren){
  const {status}=useSession();const [unreadCount,setUnreadCount]=useState(0);const [permission,setPermission]=useState<PermissionState>("checking");
  const tokenRef=useRef<string|null>(null);
  const refresh=useCallback(async()=>{if(status!=="authenticated"){setUnreadCount(0);return;}const response=await api<{unread_count:number}>("/api/notifications/unread-count");const count=Number(response.unread_count||0);setUnreadCount(count);const notifications=await getNotifications();if(notifications)await notifications.setBadgeCountAsync(count).catch(()=>false);},[status]);
  const register=useCallback(async(requestPermission:boolean)=>{const Notifications=await getNotifications();if(!Notifications||!Device.isDevice){setPermission("unavailable");return false;}if(Platform.OS==="android")await Notifications.setNotificationChannelAsync("default",{name:"Atualizacoes comerciais",importance:Notifications.AndroidImportance.HIGH,vibrationPattern:[0,250,180,250],lightColor:"#0767B4",sound:"default"});let result=await Notifications.getPermissionsAsync();if(result.status!=="granted"&&requestPermission)result=await Notifications.requestPermissionsAsync();if(result.status!=="granted"){setPermission("denied");return false;}const id=projectId();if(!id){setPermission("unavailable");return false;}const token=(await Notifications.getExpoPushTokenAsync({projectId:id})).data;await api("/api/mobile/push-token",{method:"POST",body:JSON.stringify({token,platform:Platform.OS,device_name:Device.deviceName||Device.modelName||undefined})});tokenRef.current=token;setPermission("granted");return true;},[]);
  const enable=useCallback(async()=>register(true),[register]);
  const markRead=useCallback(async(id:number)=>{const response=await api<{unread_count:number}>(`/api/notifications/${id}/read`,{method:"PATCH"});setUnreadCount(Number(response.unread_count||0));},[]);
  const markAllRead=useCallback(async()=>{await api("/api/notifications/read-all",{method:"POST"});setUnreadCount(0);const notifications=await getNotifications();if(notifications)await notifications.setBadgeCountAsync(0).catch(()=>false);},[]);
  useEffect(()=>{const timer=setTimeout(()=>{if(status!=="authenticated"){setUnreadCount(0);return;}void Promise.all([refresh(),register(false)]).catch(()=>setPermission(current=>current==="checking"?"unavailable":current));},0);return()=>clearTimeout(timer);},[refresh,register,status]);
  useEffect(()=>{setBeforeLogoutHandler(async()=>{const token=tokenRef.current;if(token)await api("/api/mobile/push-token",{method:"DELETE",body:JSON.stringify({token})});tokenRef.current=null;});return()=>setBeforeLogoutHandler(null);},[]);
  useEffect(()=>{let active=true;let subscriptions:{remove:()=>void}[]=[];void getNotifications().then(Notifications=>{if(!active||!Notifications)return;subscriptions=[Notifications.addNotificationReceivedListener(()=>{void refresh();}),Notifications.addNotificationResponseReceivedListener(event=>{void refresh();openNotification(event.notification.request.content.data);}),Notifications.addPushTokenListener(()=>{if(status==="authenticated")void register(false);})];});return()=>{active=false;subscriptions.forEach(subscription=>subscription.remove());};},[refresh,register,status]);
  const value=useMemo(()=>({unreadCount,permission,enable,refresh,markRead,markAllRead}),[unreadCount,permission,enable,refresh,markRead,markAllRead]);
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}
export function useNotifications(){const context=useContext(NotificationsContext);if(!context)throw new Error("useNotifications deve ser usado dentro de NotificationsProvider.");return context;}
