<template>
  <cv-grid fullWidth>
    <cv-row>
      <cv-column class="page-title">
        <h2>{{ $t("status.title") }}</h2>
      </cv-column>
    </cv-row>
    <cv-row v-if="error.getStatus">
      <cv-column>
        <NsInlineNotification
          kind="error"
          :title="$t('action.get-status')"
          :description="error.getStatus"
          :showCloseButton="false"
        />
      </cv-column>
    </cv-row>
    <cv-row v-if="error.listBackupRepositories">
      <cv-column>
        <NsInlineNotification
          kind="error"
          :title="$t('action.list-backup-repositories')"
          :description="error.listBackupRepositories"
          :showCloseButton="false"
        />
      </cv-column>
    </cv-row>
    <cv-row v-if="error.listBackups">
      <cv-column>
        <NsInlineNotification
          kind="error"
          :title="$t('action.list-backups')"
          :description="error.listBackups"
          :showCloseButton="false"
        />
      </cv-column>
    </cv-row>

    <cv-row>
      <cv-column :md="4" :max="4">
        <NsInfoCard
          light
          :title="$t('status.mdteam_webapp')"
          :description="webappUrl || $t('status.not_configured')"
          :icon="Wikis32"
          :loading="loading.getConfiguration"
          :isErrorShown="Boolean(error.getConfiguration)"
          :errorTitle="$t('error.cannot_retrieve_configuration')"
          :errorDescription="error.getConfiguration"
          class="min-height-card"
        >
          <template slot="content">
            <div v-if="config.host" class="card-meta">{{ tlsModeLabel }}</div>
            <NsButton
              v-if="config.host"
              kind="ghost"
              :icon="Launch20"
              :disabled="loading.getConfiguration"
              @click="openMdteamWorkspace"
            >
              {{ $t("status.open_webapp") }}
            </NsButton>
            <NsButton
              v-else
              kind="ghost"
              :icon="ArrowRight20"
              :disabled="loading.getConfiguration"
              @click="goToAppPage(instanceName, 'settings')"
            >
              {{ $t("status.configure") }}
            </NsButton>
          </template>
        </NsInfoCard>
      </cv-column>

      <cv-column :md="4" :max="4">
        <NsInfoCard
          light
          :title="config.ldap_domain || $t('status.local_auth_only')"
          :description="$t('status.user_domain')"
          :icon="Events32"
          :loading="loading.getConfiguration"
          class="min-height-card"
        >
          <template slot="content">
            <div v-if="config.ldap_domain" class="card-meta">
              {{
                $t("status.default_role_badge", {
                  role: config.ldap_default_role || "developer",
                })
              }}
            </div>
          </template>
        </NsInfoCard>
      </cv-column>

      <cv-column :md="4" :max="4">
        <NsInfoCard
          light
          :title="status.instance || '-'"
          :description="$t('status.app_instance')"
          :icon="Application32"
          :loading="loading.getStatus"
          class="min-height-card"
        />
      </cv-column>

      <cv-column :md="4" :max="4">
        <NsInfoCard
          light
          :title="installationNodeTitle"
          :titleTooltip="installationNodeTitleTooltip"
          :description="$t('status.installation_node')"
          :icon="Chip32"
          :loading="loading.getStatus"
          class="min-height-card"
        />
      </cv-column>
    </cv-row>

    <StatusResourcesSection
      :status="status"
      :loading="loading.getStatus"
      :backupRepositories="backupRepositories"
      :backups="backups"
      :loadingBackups="loading.listBackupRepositories || loading.listBackups"
    />
  </cv-grid>
</template>

<script>
import to from "await-to-js";
import { mapState } from "vuex";
import {
  QueryParamService,
  TaskService,
  UtilService,
  PageTitleService,
} from "@nethserver/ns8-ui-lib";
import Wikis32 from "@carbon/icons-vue/es/wikis/32";
import Events32 from "@carbon/icons-vue/es/events/32";
import Application32 from "@carbon/icons-vue/es/application/32";
import Chip32 from "@carbon/icons-vue/es/chip/32";
import Launch20 from "@carbon/icons-vue/es/launch/20";
import ArrowRight20 from "@carbon/icons-vue/es/arrow--right/20";
import StatusResourcesSection from "@/components/StatusResourcesSection.vue";

export default {
  name: "Status",
  components: { StatusResourcesSection },
  mixins: [TaskService, QueryParamService, UtilService, PageTitleService],
  pageTitle() {
    return this.$t("status.title") + " - " + this.appName;
  },
  data() {
    return {
      Wikis32,
      Events32,
      Application32,
      Chip32,
      Launch20,
      ArrowRight20,
      q: { page: "status" },
      urlCheckInterval: null,
      status: { instance: "", services: [], images: [], volumes: [] },
      config: {
        host: "",
        http2https: true,
        lets_encrypt: false,
        ldap_domain: "",
        ldap_default_role: "developer",
      },
      backupRepositories: [],
      backups: [],
      loading: {
        getStatus: false,
        getConfiguration: false,
        listBackupRepositories: false,
        listBackups: false,
      },
      error: {
        getStatus: "",
        getConfiguration: "",
        listBackupRepositories: "",
        listBackups: "",
      },
    };
  },
  computed: {
    ...mapState(["instanceName", "instanceLabel", "core", "appName"]),
    webappUrl() {
      return this.config && this.config.host
        ? `https://${this.config.host}`
        : "";
    },
    tlsModeLabel() {
      if (this.config.lets_encrypt) {
        return this.$t("status.tls_lets_encrypt");
      }
      return this.config.http2https
        ? this.$t("status.tls_https")
        : this.$t("status.tls_http");
    },
    installationNodeTitle() {
      if (this.status && this.status.node) {
        return (
          this.status.node_ui_name ||
          `${this.$t("status.node")} ${this.status.node}`
        );
      }
      return "-";
    },
    installationNodeTitleTooltip() {
      return this.status && this.status.node_ui_name
        ? `${this.$t("status.node")} ${this.status.node}`
        : "";
    },
  },
  beforeRouteEnter(to, from, next) {
    next((vm) => {
      vm.watchQueryData(vm);
      vm.urlCheckInterval = vm.initUrlBindingForApp(vm, vm.q.page);
    });
  },
  beforeRouteLeave(to, from, next) {
    clearInterval(this.urlCheckInterval);
    next();
  },
  created() {
    this.getStatus();
    this.getConfiguration();
    this.listBackupRepositories();
  },
  methods: {
    openMdteamWorkspace() {
      if (this.webappUrl) {
        window.open(this.webappUrl, "_blank", "noopener,noreferrer");
      }
    },
    async getStatus() {
      this.loading.getStatus = true;
      this.error.getStatus = "";
      const taskAction = "get-status";
      const eventId = this.getUuid();
      this.core.$root.$once(
        `${taskAction}-aborted-${eventId}`,
        this.getStatusAborted
      );
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        this.getStatusCompleted
      );
      const [err] = await to(
        this.createModuleTaskForApp(this.instanceName, {
          action: taskAction,
          extra: {
            title: this.$t("action." + taskAction),
            isNotificationHidden: true,
            eventId,
          },
        })
      );
      if (err) {
        this.error.getStatus = this.getErrorMessage(err);
        this.loading.getStatus = false;
      }
    },
    getStatusAborted() {
      this.error.getStatus = this.$t("error.generic_error");
      this.loading.getStatus = false;
    },
    getStatusCompleted(taskContext, taskResult) {
      this.status = taskResult.output;
      this.loading.getStatus = false;
    },
    async getConfiguration() {
      this.loading.getConfiguration = true;
      this.error.getConfiguration = "";
      const taskAction = "get-configuration";
      const eventId = this.getUuid();
      this.core.$root.$once(
        `${taskAction}-aborted-${eventId}`,
        this.getConfigurationAborted
      );
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        this.getConfigurationCompleted
      );
      const [err] = await to(
        this.createModuleTaskForApp(this.instanceName, {
          action: taskAction,
          extra: {
            title: this.$t("action." + taskAction),
            isNotificationHidden: true,
            eventId,
          },
        })
      );
      if (err) {
        this.error.getConfiguration = this.getErrorMessage(err);
        this.loading.getConfiguration = false;
      }
    },
    getConfigurationAborted() {
      this.error.getConfiguration = this.$t("error.generic_error");
      this.loading.getConfiguration = false;
    },
    getConfigurationCompleted(taskContext, taskResult) {
      this.config = Object.assign({}, this.config, taskResult.output || {});
      this.loading.getConfiguration = false;
    },
    async listBackupRepositories() {
      this.loading.listBackupRepositories = true;
      this.error.listBackupRepositories = "";
      const taskAction = "list-backup-repositories";
      const eventId = this.getUuid();
      this.core.$root.$once(
        `${taskAction}-aborted-${eventId}`,
        this.listBackupRepositoriesAborted
      );
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        this.listBackupRepositoriesCompleted
      );
      const [err] = await to(
        this.createClusterTaskForApp({
          action: taskAction,
          extra: {
            title: this.$t("action." + taskAction),
            isNotificationHidden: true,
            eventId,
          },
        })
      );
      if (err) {
        this.error.listBackupRepositories = this.getErrorMessage(err);
        this.loading.listBackupRepositories = false;
      }
    },
    listBackupRepositoriesAborted() {
      this.error.listBackupRepositories = this.$t("error.generic_error");
      this.loading.listBackupRepositories = false;
    },
    listBackupRepositoriesCompleted(taskContext, taskResult) {
      this.backupRepositories = (taskResult.output.repositories || []).sort(
        this.sortByProperty("name")
      );
      this.loading.listBackupRepositories = false;
      this.listBackups();
    },
    async listBackups() {
      this.loading.listBackups = true;
      this.error.listBackups = "";
      const taskAction = "list-backups";
      const eventId = this.getUuid();
      this.core.$root.$once(
        `${taskAction}-aborted-${eventId}`,
        this.listBackupsAborted
      );
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        this.listBackupsCompleted
      );
      const [err] = await to(
        this.createClusterTaskForApp({
          action: taskAction,
          extra: {
            title: this.$t("action." + taskAction),
            isNotificationHidden: true,
            eventId,
          },
        })
      );
      if (err) {
        this.error.listBackups = this.getErrorMessage(err);
        this.loading.listBackups = false;
      }
    },
    listBackupsAborted() {
      this.error.listBackups = this.$t("error.generic_error");
      this.loading.listBackups = false;
    },
    listBackupsCompleted(taskContext, taskResult) {
      const backups = (taskResult.output.backups || []).sort(
        this.sortByProperty("name")
      );
      for (const backup of backups) {
        const repo = this.backupRepositories.find(
          (r) => r.id === backup.repository
        );
        if (repo) {
          backup.repoName = repo.name;
        }
      }
      this.backups = backups;
      this.loading.listBackups = false;
    },
  },
};
</script>

<style scoped lang="scss">
@import "../styles/carbon-utils";

.card-meta {
  font-size: 0.875rem;
  margin-bottom: $spacing-03;
  opacity: 0.85;
}
</style>
