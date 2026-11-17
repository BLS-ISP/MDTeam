<template>
  <cv-grid fullWidth>
    <cv-row>
      <cv-column class="page-title">
        <h2>{{ $t("settings.title") }}</h2>
      </cv-column>
    </cv-row>
    <cv-row v-if="error.getConfiguration">
      <cv-column>
        <NsInlineNotification
          kind="error"
          :title="$t('action.get-configuration')"
          :description="error.getConfiguration"
          :showCloseButton="false"
        />
      </cv-column>
    </cv-row>
    <cv-row>
      <cv-column>
        <cv-tile light>
          <cv-skeleton-text
            v-if="loading.getConfiguration"
            heading
            paragraph
            :line-count="12"
            width="80%"
          />
          <cv-form v-else @submit.prevent="configureModule">
            <h4 class="section-heading first-heading">
              {{ $t("settings.network_section") }}
            </h4>
            <NsTextInput
              v-model.trim="host"
              :label="$t('settings.host')"
              :placeholder="$t('settings.host_placeholder')"
              :helper-text="$t('settings.host_helper')"
              :invalid-message="error.host"
              :disabled="isBusy"
              ref="host"
            />
            <NsToggle
              v-model="letsEncrypt"
              value="letsEncryptValue"
              :label="$t('settings.lets_encrypt')"
              :disabled="isBusy"
            >
              <template slot="text-left">{{ $t("common.disabled") }}</template>
              <template slot="text-right">{{ $t("common.enabled") }}</template>
            </NsToggle>
            <NsToggle
              v-model="http2https"
              value="http2httpsValue"
              :label="$t('settings.http2https')"
              :disabled="isBusy"
            >
              <template slot="text-left">{{ $t("common.disabled") }}</template>
              <template slot="text-right">{{ $t("common.enabled") }}</template>
            </NsToggle>

            <h4 class="section-heading">
              {{ $t("settings.auth_section") }}
            </h4>
            <NsComboBox
              v-model="ldapDomain"
              :title="$t('settings.ldap_domain')"
              :label="$t('settings.choose_ldap_domain')"
              :helperText="$t('settings.ldap_domain_helper')"
              :invalidMessage="error.ldap_domain"
              :options="domainOptions"
              :acceptUserInput="false"
              :autoFilter="true"
              :autoHighlight="true"
              :disabled="isBusy || loading.listUserDomains"
              ref="ldap_domain"
            />
            <cv-select
              v-model="ldapDefaultRole"
              :label="$t('settings.ldap_default_role')"
              :helper-text="$t('settings.ldap_default_role_helper')"
              :invalid-message="error.ldap_default_role"
              :disabled="isBusy"
              class="mg-bottom"
            >
              <cv-select-option value="developer">
                {{ $t("settings.role_developer") }}
              </cv-select-option>
              <cv-select-option value="stakeholder">
                {{ $t("settings.role_stakeholder") }}
              </cv-select-option>
              <cv-select-option value="scrum-master">
                {{ $t("settings.role_scrum_master") }}
              </cv-select-option>
              <cv-select-option value="product-owner">
                {{ $t("settings.role_product_owner") }}
              </cv-select-option>
            </cv-select>

            <SettingsRoleMappingFields
              :ldapAdminGroup.sync="ldapAdminGroup"
              :ldapPoGroup.sync="ldapPoGroup"
              :ldapSmGroup.sync="ldapSmGroup"
              :adminPassword.sync="adminPassword"
              :error="error"
              :disabled="isBusy"
            />

            <cv-row v-if="error.configureModule">
              <cv-column>
                <NsInlineNotification
                  kind="error"
                  :title="$t('action.configure-module')"
                  :description="error.configureModule"
                  :showCloseButton="false"
                />
              </cv-column>
            </cv-row>

            <NsButton
              kind="primary"
              :icon="Save20"
              :loading="loading.configureModule"
              :disabled="isBusy"
            >
              {{ $t("settings.save") }}
            </NsButton>
          </cv-form>
        </cv-tile>
      </cv-column>
    </cv-row>
  </cv-grid>
</template>

<script>
import to from "await-to-js";
import { mapState } from "vuex";
import {
  QueryParamService,
  UtilService,
  TaskService,
  PageTitleService,
} from "@nethserver/ns8-ui-lib";
import Save20 from "@carbon/icons-vue/es/save/20";
import SettingsRoleMappingFields from "@/components/SettingsRoleMappingFields.vue";
import { FQDN_REGEX, buildUserDomainOptions } from "@/utils/settingsValidation";

export default {
  name: "Settings",
  components: { SettingsRoleMappingFields },
  mixins: [TaskService, UtilService, QueryParamService, PageTitleService],
  pageTitle() {
    return this.$t("settings.title") + " - " + this.appName;
  },
  data() {
    return {
      Save20,
      q: { page: "settings" },
      urlCheckInterval: null,
      host: "",
      letsEncrypt: false,
      http2https: true,
      ldapDomain: "-",
      ldapDefaultRole: "developer",
      ldapAdminGroup: "",
      ldapPoGroup: "",
      ldapSmGroup: "",
      adminPassword: "",
      clusterDomains: [],
      fallbackDomains: [],
      loading: {
        getConfiguration: false,
        listUserDomains: false,
        configureModule: false,
      },
      error: {
        getConfiguration: "",
        configureModule: "",
        host: "",
        ldap_domain: "",
        ldap_default_role: "",
        ldap_admin_group: "",
        ldap_po_group: "",
        ldap_sm_group: "",
        admin_password: "",
      },
    };
  },
  computed: {
    ...mapState(["instanceName", "core", "appName"]),
    isBusy() {
      return this.loading.getConfiguration || this.loading.configureModule;
    },
    domainOptions() {
      return buildUserDomainOptions({
        noDomainLabel: this.$t("settings.no_user_domain"),
        clusterDomains: this.clusterDomains,
        fallbackDomains: this.fallbackDomains,
        currentDomain: this.ldapDomain,
      });
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
    this.getConfiguration();
    this.listUserDomains();
  },
  methods: {
    async listUserDomains() {
      this.loading.listUserDomains = true;
      const taskAction = "list-user-domains";
      const eventId = this.getUuid();
      this.core.$root.$once(
        `${taskAction}-aborted-${eventId}`,
        this.listUserDomainsAborted
      );
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        this.listUserDomainsCompleted
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
        this.loading.listUserDomains = false;
      }
    },
    listUserDomainsAborted() {
      this.loading.listUserDomains = false;
    },
    listUserDomainsCompleted(taskContext, taskResult) {
      const output = (taskResult && taskResult.output) || {};
      this.clusterDomains = Array.isArray(output.domains) ? output.domains : [];
      this.loading.listUserDomains = false;
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
      const config = (taskResult && taskResult.output) || {};
      this.host = config.host || "";
      this.letsEncrypt = Boolean(config.lets_encrypt);
      this.http2https =
        config.http2https !== undefined ? Boolean(config.http2https) : true;
      this.ldapDefaultRole = config.ldap_default_role || "developer";
      this.ldapAdminGroup = config.ldap_admin_group || "";
      this.ldapPoGroup = config.ldap_po_group || "";
      this.ldapSmGroup = config.ldap_sm_group || "";
      this.fallbackDomains = Array.isArray(config.available_domains)
        ? config.available_domains
        : [];
      this.loading.getConfiguration = false;
      this.$nextTick(() => {
        this.ldapDomain = config.ldap_domain ? config.ldap_domain : "-";
        this.focusElement("host");
      });
    },
    validateConfigureModule() {
      this.clearErrors(this);
      let isValidationOk = true;
      if (!this.host) {
        this.error.host = this.$t("common.required");
        this.focusElement("host");
        isValidationOk = false;
      } else if (!FQDN_REGEX.test(this.host)) {
        this.error.host = this.$t("error.invalid_fqdn");
        this.focusElement("host");
        isValidationOk = false;
      }
      if (this.adminPassword) {
        if (this.adminPassword.length < 8) {
          this.error.admin_password = this.$t("settings.min_password_length");
          isValidationOk = false;
        } else if (/["='\s\t]/.test(this.adminPassword)) {
          this.error.admin_password = this.$t("error.password_invalid_chars");
          isValidationOk = false;
        }
      }
      return isValidationOk;
    },
    configureModuleValidationFailed(validationErrors) {
      this.loading.configureModule = false;
      let focusAlreadySet = false;
      for (const validationError of validationErrors) {
        const field = validationError.parameter || validationError.field;
        if (field && field !== "(root)") {
          if (this.$te("error." + validationError.error)) {
            this.error[field] = this.$t("error." + validationError.error);
          } else if (this.$te("settings." + validationError.error)) {
            this.error[field] = this.$t("settings." + validationError.error);
          } else {
            this.error[field] = validationError.error;
          }
          if (!focusAlreadySet) {
            this.focusElement(field);
            focusAlreadySet = true;
          }
        }
      }
    },
    async configureModule() {
      if (!this.validateConfigureModule()) {
        return;
      }
      this.loading.configureModule = true;
      this.error.configureModule = "";
      const taskAction = "configure-module";
      const eventId = this.getUuid();
      this.core.$root.$once(
        `${taskAction}-aborted-${eventId}`,
        this.configureModuleAborted
      );
      this.core.$root.$once(
        `${taskAction}-validation-failed-${eventId}`,
        this.configureModuleValidationFailed
      );
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        this.configureModuleCompleted
      );

      const data = {
        host: this.host.trim(),
        http2https: Boolean(this.http2https),
        lets_encrypt: Boolean(this.letsEncrypt),
        ldap_domain: this.ldapDomain === "-" ? "" : this.ldapDomain.trim(),
        ldap_default_role: this.ldapDefaultRole || "developer",
        ldap_admin_group: this.ldapAdminGroup.trim(),
        ldap_po_group: this.ldapPoGroup.trim(),
        ldap_sm_group: this.ldapSmGroup.trim(),
      };
      if (this.adminPassword && this.adminPassword.trim()) {
        data.admin_password = this.adminPassword.trim();
      }

      const [err] = await to(
        this.createModuleTaskForApp(this.instanceName, {
          action: taskAction,
          data,
          extra: {
            title: this.$t("settings.configure_instance", {
              instance: this.instanceName,
            }),
            description: this.$t("common.processing"),
            eventId,
          },
        })
      );
      if (err) {
        this.error.configureModule = this.getErrorMessage(err);
        this.createErrorNotificationForApp(
          err,
          this.$t("task.cannot_create_task", { action: taskAction })
        );
        this.loading.configureModule = false;
      }
    },
    configureModuleAborted() {
      this.error.configureModule = this.$t("error.generic_error");
      this.loading.configureModule = false;
    },
    configureModuleCompleted() {
      this.loading.configureModule = false;
      this.adminPassword = "";
      this.getConfiguration();
    },
  },
};
</script>

<style scoped lang="scss">
@import "../styles/carbon-utils";

.section-heading {
  margin-top: $spacing-06;
  margin-bottom: $spacing-04;
}

.first-heading {
  margin-top: 0;
}

.mg-bottom {
  margin-bottom: $spacing-06;
}
</style>
