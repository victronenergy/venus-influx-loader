import PropTypes from "prop-types";
import {
  CFormCheck,
  CTable,
  CTableHead,
  CTableBody,
  CTableHeaderCell,
  CTableDataCell,
  CTableRow,
} from "@coreui/react";

function DeviceList(props) {
  return (
    <CTable bordered striped hidden={props.hidden}>
      <CTableHead>
        <CTableRow>
          <CTableHeaderCell>Installation Name</CTableHeaderCell>
          <CTableHeaderCell>Portal ID</CTableHeaderCell>
          <CTableHeaderCell>
            <CFormCheck
              id="enable"
              label=""
              onChange={props.onEnableAllPortalsChange}
              checked={
                props.availablePortalIds &&
                props.availablePortalIds.length > 0 &&
                props.settings.enabledPortalIds.length ===
                  props.availablePortalIds.length
              }
            />
          </CTableHeaderCell>
        </CTableRow>
      </CTableHead>
      <CTableBody>
        {props.availablePortalIds &&
          props.availablePortalIds.map((element, _index) => {
            const id = element.portalId ? element.portalId : element;
            const name = element.name ? element.name : "Unknown";
            return (
              <CTableRow key={id}>
                <CTableDataCell>{name}</CTableDataCell>
                <CTableDataCell>{id}</CTableDataCell>
                <CTableDataCell>
                  <CFormCheck
                    name="enablePortal"
                    id={id}
                    label="Enabled"
                    onChange={props.onEnablePortalChange}
                    checked={props.settings.enabledPortalIds.indexOf(id) !== -1}
                  />
                </CTableDataCell>
              </CTableRow>
            );
          })}
      </CTableBody>
    </CTable>
  );
}

DeviceList.propTypes = {
  hidden: PropTypes.bool,
  settings: PropTypes.object,
  onEnablePortalChange: PropTypes.func,
  onEnableAllPortalsChange: PropTypes.func,
  // NOTE: In UPNP Discovery, availablePortalIds will be array of portalId: string
  // NOTE: In VRM Discovery, availablePortalIds will be array of object with { portalId: string, name: string }
  availablePortalIds: PropTypes.array,
};

export { DeviceList };
