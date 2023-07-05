import { LitElement, PropertyValueMap, html, unsafeCSS } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { addWorkerListener, removeWorkerListener, sendToWorker } from "@utils/message";
import { Alert, Prompt } from "@views/components/Dialog";

import "@views/main/group-list/GroupList"
import "@views/main/group/Group"
import "@views/bottom-navbar/BottomNavbar"

import type { MainPostEvents, WorkerPostEvents } from "@utils/events";

import styles from "./Main.scss";

const findGroup = (groupId: GroupId, groupList?: Array<TGroup>): TGroup | undefined => {
  if (!groupList) return undefined;
  
  if (groupId === "all") return {
    channels: [],
    color: "",
    created_at: "",
    name: "all"
  };

  return groupList.find(_group => _group.name === groupId);
}

let deletedChannel: TChannel | undefined = undefined;

@customElement("view-main")
class Main extends LitElement {
  static styles = unsafeCSS(styles);

  @property({ type: Array})
  followList?: Array<TChannel>
  @property({ type: Array})
  groupList?: Array<TGroup>
  @property({ type: Array})
  streamList?: Array<TStream>
  @property({ type: Object})
  userInfo?: TUserInfo;

  @state()
  _currentGroupId: GroupId = "all"

  @state()
  _playInfo?: TChannel;

  // @state()
  // _bottomNavbarData: BottomNavbarDataType

  @query("#main-section")
  MainSection: Element;

  @query("view-group-list")
  ViewGroupList: Element;

  private _connectedChannels = [];

  async mainWorkerLisetener(e: MessageEvent<WebMessageForm<WorkerPostEvents>>) {
    const eventType = e.data.type;
    
    if (eventType === "result-add-new-group") {
      const { groupName, allGroups } = e.data.data;

      this.groupList = [ ...allGroups ];

      this._currentGroupId = groupName
    }
    else if (eventType === "result-save-aot") {
      const aot = e.data.data;
      this.userInfo!.AOT = aot;
      this.userInfo = { ...this.userInfo! };
    }
    else if (eventType === "result-changing-group-name") {
      const { newChannels, newName } = e.data.data;

      if (newName === undefined) {
        await new Alert("already exist group name").show();
        return;
      }
      
      const idx = this.groupList?.findIndex(group => group.name === this._currentGroupId);

      this.groupList![idx!].name = newName;
      this._currentGroupId = newName;

      this.followList = [...newChannels];
      this.groupList = [ ...this.groupList! ];
    }
    else if (eventType === "result-changing-group-color") {
      const { groupId, color } = e.data.data;
      const group = this.groupList?.find(_group => _group.name === groupId);

      group!.color = color;
      this.groupList = [...this.groupList!];
    }
    // GroupPostEvent results
    else if (eventType ==="result-remove-channel-from-group") {
      const { channel, group } = e.data.data;

      const cidx = this.followList?.findIndex(_channel => _channel.broadcaster_id === channel.broadcaster_id);

      const gidx = this.groupList?.findIndex(_group => _group.name === group.name);

      this.followList![cidx!] = channel;

      this.groupList![gidx!] = group;
      this.followList = [...this.followList!];
      this.groupList = [...this.groupList!];
    }
    else if (eventType === "result-sync-twitch-followed-list") {
      const { syncChannels, syncGroups, syncStreams } = e.data.data;

      this.followList = [...syncChannels];
      this.groupList = [...syncGroups];
      this.streamList = [...syncStreams];
    }
  }

  constructor() {
    super();

    window.api.onFollowEventListener((type, targetId) => {      
      if (type === "FollowButton_FollowUser") {
        this.followList!.push(deletedChannel!);
      }
      else if (type === "FollowButton_UnfollowUser") {
        const index = this.followList!.findIndex(_channel => _channel.broadcaster_id === targetId)!;
        deletedChannel = this.followList![index];
        this.followList!.splice(index, 1);
      }

      this.followList = [...this.followList!];
    })

    addWorkerListener(this.mainWorkerLisetener.bind(this));
  }

  connectSocketForChannel(channel: TChannel) {
    // TODO: socket connection for getting live event
    // this._connectedChannels
  }

  protected willUpdate(_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
    if (_changedProperties.has("userInfo")) {
      window.api.syncAot(this.userInfo!.AOT);
    }
  }

  protected firstUpdated(_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
    this.shadowRoot!.addEventListener("click", (e) => {
      const target = e.target as Element;

      if (target.tagName !== "VIEW-GROUP-LIST") {
        this.ViewGroupList.dispatchEvent(new CustomEvent("fold"));
      }
    });    
  }

  changeGroupListener(e: CustomEvent) {
    const groupId = e.detail;

    this._currentGroupId = groupId;
  }

  async addNewGroupListener(e: CustomEvent) {
    const newName = await new Prompt('Type new group\'s name').show()

    if (newName === undefined) return;

    const message: WebMessageForm<MainPostEvents> = {
      origin: "view-main",
      type: "append-new-group",
      data: newName
    }
    sendToWorker(message);
  }

  playListener(e: CustomEvent) {
    const channelId = e.detail;

    this._playInfo = this.followList?.find(_channel => _channel.broadcaster_id === channelId);

    if (this._playInfo) window.api.openPlayer(this._playInfo);
  }

  syncListener(e: CustomEvent) {
    const { channels, groups } = e.detail;

    this.followList = [...channels];
    this.groupList = [...groups];
  }

  async aotListener() {
    const toggle = !this.userInfo?.AOT;
    const result = await window.api.syncAot(toggle);

    if (!result) {
      throw new Error("error while setting AOT from Electron");
    }

    const message: WebMessageForm<MainPostEvents> = {
      origin: "view-main",
      type: "save-aot-result",
      data: toggle
    }

    sendToWorker(message);
  }
  async changeGroupNameListener() {
    if (this._currentGroupId === "all") {
      await new Alert("you cannot change group name for 'all' group").show();
      return;
    }
    else if (this._currentGroupId === "etc") {
      await new Alert("you cannot change group name for 'etc' group").show();
      return;
    }

    const newName = await new Prompt('Type changed group name').show()

    if (newName === undefined) return;

    const message: WebMessageForm<MainPostEvents> = {
      origin: "view-main",
      type: "change-group-name",
      data: {
        id: this._currentGroupId,
        name: newName
      }
    }
    sendToWorker(message);
  }
  goHomeListener() {
    this._currentGroupId = "all";
  }
  async chagneColorListener() {
    if (this._currentGroupId === "all") {
      await new Alert("color picker").show();
      return;
    }

    const newColor = "#2139f";
    const message: WebMessageForm<MainPostEvents> = {
      origin: "view-main",
      type: "change-group-color",
      data: {
        groupId: this._currentGroupId,
        color: newColor
      }
    }
    sendToWorker(message);
  }
  syncFromTwitchListener() {
    const message: WebMessageForm<MainPostEvents> = {
      origin: "view-app",
      type: "sync-twitch-followed-list",
      data: this.userInfo
    };
    
    sendToWorker(message);
  }

  disconnectedCallback(): void {
    removeWorkerListener(this.mainWorkerLisetener);
  }

  render() {
    return html`
      <section id="main-section">
        <view-group-list 
          @addNewGroup=${this.addNewGroupListener}
          @changeGroup=${this.changeGroupListener}
          .groups=${this.groupList}
        ></view-group-list>

        <main>
          <view-group
            @play=${this.playListener}
            @sync=${this.syncListener}
            .group=${findGroup(this._currentGroupId, this.groupList)}
            .channels=${this.followList}
            .liveChannels=${this.streamList}
          ></view-group>
        </main>

        <view-bottom-navbar
          @aot=${this.aotListener}
          @changeGroupName=${this.changeGroupNameListener}
          @goHome=${this.goHomeListener}
          @changeColor=${this.chagneColorListener}
          @syncFromTwitch=${this.syncFromTwitchListener}
          .userInfo=${this.userInfo}
        ></view-bottom-navbar>
      </section>
    `;
  }
}
